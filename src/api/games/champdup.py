import datetime

from game import Game, GenericGameConfig, PublicConfig, MessageSchema, ProcessedMessage, GameStatus
from result import Result
from broadcaster import Broadcast
from fastapi import WebSocket
from enum import Enum
from metaenum import MetaEnum
from terminal import Terminal
from typing import Literal, Any
from pydantic import BaseModel
from globals import MAX_USERNAME_LENGTH
from fuzzywuzzy import fuzz

DEFAULT_PUBLIC_ATTRS = {
    "max_players": 10,
    "bonus_round_enabled": True,
    "polls_enabled": True,
    "poll_duration": 10,
    "host_only_polls": False,
    "enable_private_messages": True,
}

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
        return datetime.datetime.fromisoformat(self.ends) > datetime.datetime.now();

RUNNING_EVENTS = ["D1", "C1", "V1", "D2", "C2", "V2", "B"]

class ChampdUp(Game):
    poll: None | Poll

    def __init__(self, b: Broadcast, t: Terminal) -> None:
        super().__init__(b, t)
        self.config = ChampdUpConfig()
        self.poll = None
        self.event_idx = 0
        self.events = RUNNING_EVENTS[:len(RUNNING_EVENTS) - self.config.public["bonus_round_enabled"]]
    
    def get_current_event(self) -> str:
        return RUNNING_EVENTS[self.event_idx]
    
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
        return self.config.public["max_players"]
    
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
            self.config.public[k] = v
        self.max_players = self.config.public["max_players"]
        self.events = RUNNING_EVENTS[:len(RUNNING_EVENTS) - self.config.public["bonus_round_enabled"]]
        return errors
    
    def validate_chat_msg(self, msg: MessageSchema) -> bool:
        '''Assumes `msg.type` == `MessageType.CHAT`.'''
        return type(msg.value) == str
    
    def validate_poll_msg(self, msg: MessageSchema) -> bool:
        if self.poll and not self.poll.is_active():
            self.poll = None
        if self.poll:
            return False
        if msg.author != 0 and self.config.public["host_only_polls"]:
            return False
        if type(msg.value) != str or not self.config.public["polls_enabled"]:
            return False
        text: str = msg.value
        if text.startswith("/poll "):
            text = text.removeprefix("/poll ").strip()
            return bool(text)
        return False
    
    def prepare_poll_broadcast(self, text: str, author: int | str) -> ProcessedMessage:
        pm = ProcessedMessage()
        self.poll = Poll(
            ends=(datetime.datetime.now() + datetime.timedelta(seconds=self.config.public["poll_duration"])).isoformat(),
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
        if not self.config.public["enable_private_messages"]:
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
            self.debug(partition)
            for v in player_names:
                if v.lower().startswith(partition.lower()):
                    self.debug(f"V: {v}")
                    match = v
                    matched_partition = partition
            if len(partition) > 24:
                break
        #match = list(self.players.keys())[player_lower.index(partition.lower())]
        if match and sender != match:
            msg = text[len(matched_partition):].strip()
            self.debug(f"HERE NOW, {match}, {matched_partition}, {msg}")
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