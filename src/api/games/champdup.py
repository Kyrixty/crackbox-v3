import datetime
import inspect
import anyio
import threading
import random
import math
import os

from game import Game, GenericGameConfig, PublicConfig, MessageSchema, ProcessedMessage, GameStatus, create_threaded_async_action
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
from player import Player

DEFAULT_PUBLIC_ATTRS = {
    "max_players": 10,
    "bonus_round_enabled": False,
    "polls_enabled": True,
    "poll_duration": 10,
    "host_only_polls": False,
    "enable_private_messages": True,
    "draw_duration": 20 if DEBUG else 180,
    "vote_duration": 10,
    "awards_duration": 5,
}

task_threads = []
task_threads_lock = threading.Lock()

class Timer:
    def __init__(self, name: str, t: Terminal, callback: Coroutine | Callable | None = None) -> None:
        self.name = name
        self.callback = callback
        self.finished = False
        self.t = t
        self.log = t.log

    async def run(self, ends: datetime.datetime) -> None:
        duration = (ends - datetime.datetime.now()).total_seconds()
        self.log(f"Sleeping for {duration} seconds")
        with task_threads_lock:
            self.finished = False
        await anyio.sleep(duration)
        self.log(f"Finished sleeping")
        with task_threads_lock:
            if self.finished: # killed at some point before duration was reached
                return
            if not self.finished:
                self.finished = True
        if self.callback:
            if inspect.iscoroutinefunction(self.callback):
                self.log("Awaiting callback")
                await self.callback()
            else:
                self.log("Calling callback")
                self.callback()
        self.log("Timer finished.")

    async def start(self, ends: datetime.datetime) -> None:
        with task_threads_lock:
            self.finished = False
        create_threaded_async_action(self.run, (ends,))()

    def kill(self) -> None:
        with task_threads_lock:
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
    NOTIFY = "NOTIFY"
    IMAGE = "IMAGE"
    MATCHUP = "MATCHUP"
    MATCHUP_VOTE = "MATCHUP_VOTE"
    MATCHUP_RESULT = "MATCHUP_RESULT"

class NotifyType(str, Enum, metaclass=MetaEnum):
    SUCCESS = "SUCCESS"
    FAIL = "FAIL"
    INFO = "INFO"

class Poll(BaseModel):
    ends: str
    prompt: str
    yes: set[str]
    no: set[str]

    def is_active(self) -> bool:
        return datetime.datetime.fromisoformat(self.ends) > datetime.datetime.now()

class Image(BaseModel):
    title: str
    dUri: str | None = None
    artists: list[Player]
    prompt: str

class AwardName(str, Enum, metaclass=MetaEnum):
    DOMINATION = "DOMINATION"
    ON_FIRE = "ON_FIRE"
    BRUH = "BRUH"

class Award(BaseModel):
    name: AwardName
    bonus: int

class ImageMatchup(BaseModel):
    left: Image
    leftVotes: set[str]
    right: Image
    rightVotes: set[str]

    def add_vote(self, username: str, target: Literal["left", "right"]):
        if target == "left":
            if username in self.rightVotes:
                self.rightVotes.remove(username)
            self.leftVotes.add(username)
        elif target == "right":
            if username in self.leftVotes:
                self.leftVotes.remove(username)
            self.rightVotes.add(username)

class MatchupManager:
    def __init__(self) -> None:
        self._idx = -1
        self.matchups: list[ImageMatchup] = []
        self.matchup_finished = False
    
    def has_started(self) -> bool:
        return self._idx != -1
    
    def has_ended(self) -> bool:
        return self._idx >= len(self.matchups)
    
    def finish_matchup(self) -> None:
        self.matchup_finished = True
    
    def next_matchup(self):
        self._idx += 1
        self.matchup_finished = False
    
    def get_matchup(self):
        return self.matchups[self._idx]
    
    def add_matchup(self, left: Image, right: Image):
        self.matchups.append(ImageMatchup(left=left, right=right, leftVotes=set(), rightVotes=set()))
    
    def reset(self):
        self._idx = -1
        self.matchups = []
    
dirname = os.path.dirname(__file__)
with open(f"{dirname}/champdup-prompts.txt", mode="r") as f:
    prompts = [l.replace("\n", "") for l in f.readlines()]
with open(f"{dirname}/champdup-default-titles.txt", mode="r") as f:
    titles = [l.replace("\n", "") for l in f.readlines()]
with open(f"{dirname}/champdup-didnt-draw.txt", mode="r") as f:
    didnt_draw_data_uri = f.read()

class DrawManager:
    def __init__(self, player_list: list[Player]) -> None:
        self.images: dict[str, Image] = {}
        self.prompt_pool = prompts.copy()
        self.prompts: dict[str, str] = {}
        self.players = player_list
        self.reset()
    
    def add_image(self, username: str, img: Image):
        self.images[username] = img
    
    def get_images(self) -> list[Image]:
        return list(self.images.values())
    
    def reset(self):
        self.images = {}

        for player in self.players:
            prompt = random.choice(self.prompt_pool)
            self.prompt_pool.remove(prompt)
            self.prompts[player.username] = prompt
            self.images[player.username] = Image(title=random.choice(titles), dUri=didnt_draw_data_uri, artists=[player], prompt=prompt)

    def create_counters(self) -> dict[str, Image]:
        plrs = self.players
        offset = random.randint(1, len(plrs) - 1)
        # Get counters by applying an offset to each player
        # (1 <= offset < len(plrs))
        ctrs = [plrs[(plrs.index(plr) + offset) % len(plrs)].username for plr in plrs]
        ctrImgMap = {}
        for plr, ctr in zip(self.players, ctrs):
            ctrImgMap[plr.username] = self.images[ctr]
        return ctrImgMap

class CounterManager:
    def __init__(self, ctr_img_map: dict[str, Image], player_list: list[Player]) -> None:
        self.ctr_img_map: dict[str, Image] = ctr_img_map
        self.ctrs: dict[str, Image] = {}
        self.players = player_list

    
    def set_ctr_img_map(self, map: dict[str, Image]):
        self.ctr_img_map = map
        for player in self.players:
            self.ctrs[player.username] = Image(title=random.choice(titles), dUri=didnt_draw_data_uri, artists=[player], prompt=random.choice(prompts))

    def get_matchups(self) -> list[ImageMatchup]:
        matchups = []
        for og, ctr in zip(self.ctr_img_map.values(), self.ctrs.values()):
            matchups.append(ImageMatchup(left=og, right=ctr, leftVotes=set(), rightVotes=set()))
        return matchups
    
    def set_ctr(self, username: str, img: Image):
        self.ctrs[username] = img
        
    def reset(self):
        self.set_ctr_img_map({})
        self.ctrs = {}

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
TIMED_EVENTS = ["D1", "C1", "D2", "C2"]

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
        self.draw_manager = DrawManager([])
        self.ctr_manager = CounterManager({}, [])
        self.matchup_manager = MatchupManager()
        self.timer = Timer("ChampdUp Timer", t, self.iter_game_events)
    
    
    def get_public_field(self, key: str) -> Any:
        return self.config.public[key]
    
    async def iter_game_events(self) -> None:
        self.debug("iter_game_events called")
        event_before = self.get_current_event()
        self.event_idx += 1
        self.debug(str(self.event_idx))
        if self.event_idx >= len(self.events):
            return
        event = self.get_current_event()
        self.debug(f"Processing {event.name}..")
        if event.name == "B" and not self.get_public_field("bonus_round_enabled"):
            return await self.iter_game_events()
        if event.name in ("D1", "D2"):
            self.draw_manager.players = self.get_player_list()
            self.draw_manager.reset()
        if event.name in ("C1", "C2"):
            self.ctr_manager.reset()
            self.ctr_manager.players = self.get_player_list()
            self.ctr_manager.set_ctr_img_map(self.draw_manager.create_counters())
        if event.name in ("V1", "V2"):
            self.matchup_manager.reset()
            # Setup matchup manager state before broadcasting & handling vote rounds
            for matchup in self.ctr_manager.get_matchups():
                self.matchup_manager.add_matchup(matchup.left, matchup.right)
        if event.timed:
            ends = (datetime.datetime.now() + datetime.timedelta(seconds=self.get_public_field("draw_duration")))
            event.ends = ends.isoformat()
            await self.timer.start(ends)
        for username in self.ws_map:
            await self.send(self.ws_map[username], MessageSchema(type=MessageType.STATE, value=self.get_game_state(username), author=0))
        if event.name in ("V1", "V2"):
            # Begin handling vote rounds
            await self.iter_vote_round()
    
    async def filter_send(self, msg: MessageSchema, whitelist: list[str | int] = [], blacklist: list[str | int] = []):
        '''Filters who to send a message to.
        
        If `whitelist` and `blacklist` are empty lists,
        the message is broadcast to all clients. Otherwise:
        
        If `whitelist` is specified, broadcast only to
        whoever is in the whitelist. Ignore the blacklist.
        
        If `blacklist` is specified (and `whitelist` isn't [racist!!!!1111!]),
        broadcast only to whoever isn't in the blacklist'''

        if not whitelist and not blacklist:
            await self.publish(msg.type, msg.value, msg.author)
        if whitelist:
            for username in whitelist:
                await self.send(self.ws_map[username], msg)
        else:
            for username in self.ws_map:
                if username not in blacklist:
                    await self.send(self.ws_map[username], msg)
    
    async def iter_vote_round(self):
        if not self.matchup_manager.matchups:
            self.error("No matchups found at vote round. iter_vote_round will likely error, ensure matchup_manager's matchups have been set before iter_vote_round is called!")
        if self.matchup_manager.has_started() and not self.matchup_manager.matchup_finished:
            # If the matchup manager has started before we move to the next matchup,
            # then there must have been a previous matchup that just ended. Broadcast
            # matchup winner
            matchup = self.matchup_manager.get_matchup()
            llv = len(matchup.leftVotes)
            lrv = len(matchup.rightVotes)

            # Calculate points
            lp, rp = 0, 0
            scalar = 1897

            # We want at least (roughly) 50% of players to have voted for a bonus
            # to be awarded
            can_bonus = (llv + lrv) > math.floor(len(self.players) / 2)
            dominated = 0 in (llv, lrv) and (llv, lrv).count(0) == 1
            on_fire = not dominated and (llv > 2 * lrv or lrv > 2 * llv)
            D = can_bonus * dominated * 250 * len(self.players)
            F = can_bonus * on_fire * 125 * max(lrv, lrv)
            B = ((llv + lrv) == 0) * 1
            winner = matchup.left

            if llv == lrv:
                # Because right image countered left image,
                # left image is given a slight bonus in points
                lp += scalar * llv + 100
                rp += scalar * lrv
                for artist in matchup.left.artists:
                    self.players[artist.username].points += lp
                
                for artist in matchup.right.artists:
                    self.players[artist.username].points += rp
            elif llv > lrv:
                lp += scalar * llv + D + F
                for artist in matchup.left.artists:
                    self.players[artist.username].points += lp
            else:
                winner = matchup.right
                rp += scalar * lrv + D + F
                for artist in matchup.right.artists:
                    self.players[artist.username].points += rp
            
            awards: list[Award] = []
            if dominated:
                awards.append(Award(name=AwardName.DOMINATION, bonus=D))
            if on_fire:
                awards.append(Award(name=AwardName.ON_FIRE, bonus=F))
            if (llv + lrv) == 0:
                awards.append(Award(name=AwardName.BRUH, bonus=B))
            
            self.matchup_manager.finish_matchup()
            ends = (datetime.datetime.now() + datetime.timedelta(seconds=self.get_public_field("awards_duration")))
            await self.filter_send(MessageSchema(
                type=MessageType.MATCHUP_RESULT,
                value={
                    "winner": winner,
                    "points": lp if llv >= lrv else rp,
                    "awards": awards,
                    "ends": ends.isoformat(),
                },
                author=0,
            ))
            # Exit early, next pass (after awards have been shown) this block will not be called
            # as we finished the matchup.
            self.timer.callback = self.iter_vote_round
            return await self.timer.start(ends)


        self.matchup_manager.next_matchup()
        if self.matchup_manager.has_ended():
            self.timer.callback = self.iter_game_events
            return await self.iter_game_events()
        self.timer.callback = self.iter_vote_round
        ends = (datetime.datetime.now() + datetime.timedelta(seconds=self.get_public_field("vote_duration")))
        await self.filter_send(MessageSchema(
            type=MessageType.MATCHUP,
            value={"matchup": self.matchup_manager.get_matchup(), "ends": ends},
            author=0,
        ))
        await self.timer.start(ends)
    
    def get_current_event(self) -> Event:
        return self.events[self.event_idx]
    
    def get_game_state(self, username: str | int) -> dict[str, Any]:
        event_data = {}
        if self.get_current_event().name in ("D1", "D2"):
            if username != 0:
                self.debug(self.draw_manager.prompts[username])
                event_data = {
                    "prompt": self.draw_manager.prompts[username]
                }
        if self.get_current_event().name in ("C1", "C2"):
            if username != 0:
                self.debug(str(self.ctr_manager.ctr_img_map[username]))
                event_data = {
                    "counter": self.ctr_manager.ctr_img_map[username]
                }
        if self.get_current_event().name in ("V1", "V2"):
            if self.matchup_manager.has_started():
                event_data = {
                    "matchup": self.matchup_manager.get_matchup()
                }
        return {
            "host_connected": self.host_connected,
            "status": self.status,
            "players": self.get_player_list(),
            "event": self.get_current_event(),
            "event_data": event_data,
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
            if k == "awards_duration":
                try:
                    v = int(v)
                except ValueError:
                    errors.append((k, "Value must be an integer"))
                    continue
                if v < 3:
                    errors.append((k, "Value must be >= 3"))
                    continue
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
        _sender = str(sender)
        for word in words:
            partition = " ".join([partition, word]).strip()
            for v in sorted(player_names, key=lambda x: len(x)):
                if v.lower() == _sender.lower():
                    continue
                if v.lower() == partition.lower():
                    match = v
                    matched_partition = partition
                    break
            if match or len(partition) > MAX_USERNAME_LENGTH:
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
            if not sender in self.ws_map or not match in self.ws_map:
                return
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
            
        if self.get_current_event().name in ("D1", "D2"):
            if msg.type == MessageType.IMAGE:
                # User submitted draw image
                if type(msg.value) == dict and "dUri" in msg.value and type(msg.value["dUri"]) == str and "title" in msg.value and type(msg.value["title"]) == str and len(msg.value["title"]):
                    self.draw_manager.add_image(username, Image(title=msg.value["title"], dUri=msg.value["dUri"], artists=[self.get_player(username).data], prompt=self.draw_manager.prompts[username]))
                    pm.add_msg(MessageType.NOTIFY, {"type": NotifyType.SUCCESS, "msg": "Your image submitted successfully!"}, 0)
        if self.get_current_event().name in ("C1", "C2"):
            if msg.type == MessageType.IMAGE:
                if type(msg.value) == dict and "dUri" in msg.value and type(msg.value["dUri"]) == str and "title" in msg.value and type(msg.value["title"]) == str and len(msg.value["title"]):
                    self.ctr_manager.set_ctr(username, Image(title=msg.value["title"], dUri=msg.value["dUri"], artists=[self.get_player(username).data], prompt=self.ctr_manager.ctr_img_map[username].prompt))
                    pm.add_msg(MessageType.NOTIFY, {"type": NotifyType.SUCCESS, "msg": "Your image submitted successfully!"}, 0)
        if self.get_current_event().name in ("V1", "V2"):
            if msg.type == MessageType.MATCHUP_VOTE:
                if not self.matchup_manager.has_started() or self.matchup_manager.matchup_finished:
                    return pm
                m = self.matchup_manager.get_matchup()
                artists = [x.username for x in m.left.artists] + [x.username for x in m.right.artists]
                if username in artists:
                    return pm
                if msg.value in ("left", "right"):
                    self.matchup_manager.get_matchup().add_vote(username, msg.value)
                    pm.add_broadcast(MessageType.MATCHUP_VOTE, {
                        "left": self.matchup_manager.get_matchup().leftVotes,
                        "right": self.matchup_manager.get_matchup().rightVotes,
                    }, 0)
        return pm

import atexit

def clean_task_threads():
    print(f"Cleaning {len(task_threads)} threads..")
    for t in task_threads:
        t: threading.Thread = t
        t.join()

atexit.register(clean_task_threads)