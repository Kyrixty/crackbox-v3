import datetime

from game import Game, GenericGameConfig, PublicConfig, MessageSchema, DefaultMessageTypes, ProcessedMessage
from result import Result
from broadcaster import Broadcast
from fastapi import WebSocket
from enum import Enum
from metaenum import MetaEnum
from terminal import Terminal
from typing import Literal
from pydantic import BaseModel

DEFAULT_PUBLIC_ATTRS = {
    "max_players": 10,
    "bonus_round_enabled": True,
    "polls_enabled": True,
    "poll_duration": 10,
    "host_only_polls": False,
}

class ChampdUpConfig(GenericGameConfig):
    public: PublicConfig = DEFAULT_PUBLIC_ATTRS

class MessageType(str, Enum, metaclass=MetaEnum):
    CONNECT = "CONNECT"
    DISCONNECT = "DISCONNECT"
    START = "START"
    STOP = "STOP"
    CHAT = "CHAT"
    POLL = "POLL"
    POLL_VOTE = "POLL_VOTE"

class Poll(BaseModel):
    ends: str
    prompt: str
    yes: set[str]
    no: set[str]

    def is_active(self) -> bool:
        return datetime.datetime.fromisoformat(self.ends) > datetime.datetime.now();

class ChampdUp(Game):
    poll: None | Poll

    def __init__(self, b: Broadcast, t: Terminal) -> None:
        super().__init__(b, t)
        self.config = ChampdUpConfig()
        self.poll = None
    
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
            self.config.public[k] = v
        self.max_players = self.config.public["max_players"]
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
    
    async def process_host_message(self, ws: WebSocket, msg: MessageSchema, username: int) -> ProcessedMessage:
        pm = ProcessedMessage()
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
        if msg.type == MessageType.CHAT:
            if self.validate_chat_msg(msg):
                if self.validate_poll_msg(msg):
                    return self.prepare_poll_broadcast(msg.value, username)
                pm.add_broadcast(msg.type, msg.value, self.get_player(username).data)
        if msg.type == MessageType.POLL_VOTE:
            if msg.value.lower() in ("yes", "no"):
                return self.handle_poll_vote(msg.value.lower(), username)
        return pm