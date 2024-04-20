import datetime
import inspect
import anyio
import threading

from game import Game, GenericGameConfig, PublicConfig, MessageSchema, ProcessedMessage, GameStatus
from result import Result
from broadcaster import Broadcast
from fastapi import WebSocket
from enum import Enum
from metaenum import MetaEnum
from terminal import Terminal
from typing import Literal, Any, Coroutine, Callable, Tuple
from pydantic import BaseModel
from globals import MAX_USERNAME_LENGTH, DEBUG
from fuzzywuzzy import fuzz

DEFAULT_PUBLIC_ATTRS = {
    "max_players": 10,
    "bonus_round_enabled": True,
    "polls_enabled": True,
    "poll_duration": 10,
    "host_only_polls": False,
    "enable_private_messages": True,
    "draw_duration": 20 if DEBUG else 180,
    "vote_duration": 10,
}

task_threads = []
task_threads_lock = threading.Lock()

def create_threaded_async_action(
    action: Coroutine, args: Tuple = ()
) -> Callable:
    global task_threads
    def wrapper():
        async def do_async() -> None:
            await action(*args)
        t = threading.Thread(target=anyio.run, args=(do_async,), daemon=False)
        task_threads.append(t)
        t.start()

    return wrapper

class Timer:
    def __init__(self, name: str, t: Terminal, callback: Coroutine | Callable | None = None) -> None:
        self.name = name
        self.callback = callback
        self.running = False
        self.finished = False
        self.t = t
        self.log = t.log

    async def run(self, ends: datetime.datetime) -> None:
        duration = (ends - datetime.datetime.now()).total_seconds()
        self.log(f"Sleeping for {duration} seconds")
        with task_threads_lock:
            self.running = True
            self.finished = False
        await anyio.sleep(duration)
        self.log(f"Finished sleeping")
        with task_threads_lock:
            if self.finished: # killed at some point before duration was reached
                return
        if self.callback:
            if inspect.iscoroutinefunction(self.callback):
                self.log("Awaiting callback")
                await self.callback()
            else:
                self.log("Calling callback")
                self.callback()
        with task_threads_lock:
            self.finished = True
        self.log("Timer finished.")

    async def start(self, ends: datetime.datetime) -> None:
        with task_threads_lock:
            self.running = True
            self.finished = False
        create_threaded_async_action(self.run, (ends,))()

    def kill(self) -> None:
        with task_threads_lock:
            self.running = False
            self.finished = True

class ChampdUpConfig(GenericGameConfig):
    public: PublicConfig = DEFAULT_PUBLIC_ATTRS

class MessageType(str, Enum, metaclass=MetaEnum):
    STATE = "STATE"
    STATUS = "STATUS"
    CHAT = "CHAT"
    POLL = "POLL"
    POLL_VOTE = "POLL_VOTE"
    PM = "PM"

class Poll(BaseModel):
    ends: str
    prompt: str
    yes: set[str]
    no: set[str]

    def is_active(self) -> bool:
        return datetime.datetime.fromisoformat(self.ends) > datetime.datetime.now()

class Event(BaseModel):
    name: str
    timed: bool
    ends: str | None = None

    def is_active(self) -> bool:
        return datetime.datetime.fromisoformat(self.ends) > datetime.datetime.now()

RUNNING_EVENTS = ["D1", "C1", "V1", "D2", "C2", "V2", "B", "L"]

# Note: technically all of the events have timers attached but vote events
# and the bonus round timers behave differently (vote timer is per image,
# multiple types of bonus rounds with different timers each). The events 
# below can be handled generically though
TIMED_EVENTS = ["D1", "C1", "V1", "D2", "C2", "V2", "B"]

class ChampdUp(Game):
    poll: None | Poll

    def __init__(self, b: Broadcast, t: Terminal) -> None:
        super().__init__(b, t)
        self.config = ChampdUpConfig()
        self.poll = None
        self.event_idx = -1
        self.events: list[Event] = []
        for event_name in RUNNING_EVENTS:
            self.events.append(Event(name=event_name, timed=event_name in TIMED_EVENTS))
        self.timer = Timer("ChampdUp Timer", t, self.iter_game_events)
    
    def get_public_field(self, key: str) -> Any:
        return self.config.public[key]
    
    async def iter_game_events(self) -> None:
        self.timer.kill()
        event_before = self.get_current_event()
        if event_before.name in ("V1", "V2"):
            ... # Loop V1/V2 until all vote rounds are complete
        self.event_idx += 1
        event = self.get_current_event()
        if self.event_idx >= len(self.events):
            return
        self.debug(f"Processing {event.name}..")
        if event.name == "B" and not self.get_public_field("bonus_round_enabled"):
            return await self.iter_game_events()
        if event.timed:
            ends = (datetime.datetime.now() + datetime.timedelta(seconds=self.get_public_field("draw_duration")))
            event.ends = ends.isoformat()
            await self.timer.start(ends)
        for username in self.ws_map:
            await self.send(self.ws_map[username], MessageSchema(type=MessageType.STATE, value=self.get_game_state(username), author=0))
        
    
    def get_current_event(self) -> Event:
        return self.events[self.event_idx]
    
    def get_game_state(self, username: str | int) -> dict[str, Any]:
        return {
            "host_connected": self.host_connected,
            "status": self.status,
            "players": self.get_player_list(),
            "event": self.get_current_event(),
            "event_data": {},
            "via": username,
        }
    
    def get_max_players(self) -> int:
        return self.get_public_field("max_players")
    
    def load_public_config(self, pub: PublicConfig) -> list[tuple[str, str]]:
        errors: list[tuple[str, str]] = []
        for k, v in pub.items():
            if k not in DEFAULT_PUBLIC_ATTRS:
                errors.append((k, "Unrecognized key"))
                continue
            if k == "max_players":
                try:
                    v = int(v)
                except ValueError:
                    errors.append((k, "Max players must be a number"))
                    continue
                if v < 3:
                    errors.append((k, "Max players must be at least 3 (a minimum of 3 players are required to play)."))
                    continue
            if k == "poll_duration":
                try:
                    v = int(v)
                except ValueError:
                    errors.append((k, "Poll duration must be a whole number > 5"))
                    continue
                if v < 5:
                    errors.append((k, "Poll duration must be a whole number > 5"))
                    continue
            if k in ("bonus_round_enabled", "polls_enabled", "host_only_polls"):
                try:
                    v = bool(v)
                except ValueError:
                    errors.append((k, "Value must be true/false"))
                    continue
            if k in ("draw_duration", "vote_duration"):
                try:
                    v = int(v)
                except ValueError:
                    errors.append((k, "Value must be an integer"))
                    continue
                if v < 10:
                    errors.append((k, "Value must be at least 10 (seconds)"))
            self.config.public[k] = v
        self.max_players = self.get_public_field("max_players")
        return errors
    
    def validate_chat_msg(self, msg: MessageSchema) -> bool:
        '''Assumes `msg.type` == `MessageType.CHAT`.'''
        return type(msg.value) == str
    
    def validate_poll_msg(self, msg: MessageSchema) -> bool:
        if self.poll and not self.poll.is_active():
            self.poll = None
        if self.poll:
            return False
        if msg.author != 0 and self.get_public_field("host_only_polls"):
            return False
        if type(msg.value) != str or not self.get_public_field("polls_enabled"):
            return False
        text: str = msg.value
        if text.startswith("/poll "):
            text = text.removeprefix("/poll ").strip()
            return bool(text)
        return False
    
    def prepare_poll_broadcast(self, text: str, author: int | str) -> ProcessedMessage:
        pm = ProcessedMessage()
        self.poll = Poll(
            ends=(datetime.datetime.now() + datetime.timedelta(seconds=self.get_public_field("poll_duration"))).isoformat(),
            prompt=text.removeprefix("/poll "),
            yes=set(),
            no=set(),
        )
        if author == 0:
            pm.add_broadcast(MessageType.POLL, self.poll, author)
        else:
            pm.add_broadcast(MessageType.POLL, self.poll, self.get_player(author).data)
        return pm
    
    def handle_poll_vote(self, vote: Literal["Yes"] | Literal["No"], author: str | int) -> ProcessedMessage:
        pm = ProcessedMessage()
        if not self.poll or vote not in ("yes", "no") or not self.poll.is_active():
            return pm
        author_name = author
        if type(author) == int:
            author_name = "Host"
        for v in (self.poll.yes, self.poll.no):
            if author_name in v:
                v.remove(author_name)
        if vote == "yes":
            self.poll.yes.add(author_name)
        else:
            self.poll.no.add(author_name)
        if author == 0:
            pm.add_broadcast(MessageType.POLL_VOTE, self.poll, author)
        else:
            pm.add_broadcast(MessageType.POLL_VOTE, self.poll, self.get_player(author).data)
        return pm
    
    async def handle_private_message(self, sender: str | int, command: str):
        if not self.get_public_field("enable_private_messages"):
            return False
        if type(command) != str or not command.startswith("/pm "):
            return False
        match = ""
        matched_partition = ""
        text = command.removeprefix("/pm ")
        # Find best match, if any
        player_names = list(self.players.keys())
        partition = ""
        words = text.split(" ")
        for word in words:
            partition = " ".join([partition, word]).strip()
            for v in player_names:
                if v.lower().startswith(partition.lower()):
                    match = v
                    matched_partition = partition
            if len(partition) > MAX_USERNAME_LENGTH:
                break
        #match = list(self.players.keys())[player_lower.index(partition.lower())]
        if match and sender != match:
            msg = text[len(matched_partition):].strip()
            #self.debug(f"HERE NOW, {match}, {matched_partition}, {msg}")
            if not msg:
                return
            author = sender
            if author != 0:
                author = self.get_player(author).data
            await self.send(self.ws_map[sender], MessageSchema(type=MessageType.PM, value={"msg": msg, "from": "Host" if sender == 0 else sender, "to": match}, author=author))
            await self.send(self.ws_map[match], MessageSchema(type=MessageType.PM, value={"msg": msg, "from": "Host" if sender == 0 else sender, "to": match}, author=author))
            return True
        return False
    
    async def process_host_message(self, ws: WebSocket, msg: MessageSchema, username: int) -> ProcessedMessage:
        pm = ProcessedMessage()
        if msg.type == MessageType.STATUS:
            if not msg.value in GameStatus or len(self.players) < 3:
                return pm
            self.status = msg.value
            if self.status == GameStatus.RUNNING:
                await self.iter_game_events()
            else:
                self.timer.kill()
            if self.status != GameStatus.RUNNING:
                for name, _ws in self.ws_map.items():
                    self.debug(f"{name}, {_ws}")
                    await self.send(_ws, MessageSchema(type=MessageType.STATE, value=self.get_game_state(name), author=0))
            return pm
        if msg.type == MessageType.PM:
            await self.handle_private_message(username, msg.value)
            return pm
        if msg.type == MessageType.CHAT:
            if self.validate_chat_msg(msg):
                if self.validate_poll_msg(msg):
                    return self.prepare_poll_broadcast(msg.value, username)
                pm.add_broadcast(msg.type, msg.value, 0)
        if msg.type == MessageType.POLL_VOTE:
            if msg.value.lower() in ("yes", "no"):
                return self.handle_poll_vote(msg.value.lower(), username)
        return pm
    
    async def process_plyr_message(self, ws: WebSocket, msg: MessageSchema, username: str) -> ProcessedMessage:
        pm = ProcessedMessage()
        if msg.type == MessageType.PM:
            await self.handle_private_message(username, msg.value)
            return pm
        if msg.type == MessageType.CHAT:
            if self.validate_chat_msg(msg):
                if self.validate_poll_msg(msg):
                    return self.prepare_poll_broadcast(msg.value, username)
                pm.add_broadcast(msg.type, msg.value, self.get_player(username).data)
        if msg.type == MessageType.POLL_VOTE:
            if msg.value.lower() in ("yes", "no"):
                return self.handle_poll_vote(msg.value.lower(), username)
        return pm

import atexit

def clean_task_threads():
    print(f"Cleaning {len(task_threads)} threads..")
    for t in task_threads:
        t: threading.Thread = t
        t.join()

atexit.register(clean_task_threads)