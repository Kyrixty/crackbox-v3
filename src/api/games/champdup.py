from game import Game, GenericGameConfig, PublicConfig, MessageSchema, DefaultMessageTypes, ProcessedMessage
from result import Result
from broadcaster import Broadcast
from fastapi import WebSocket
from enum import Enum
from metaenum import MetaEnum
from terminal import Terminal

DEFAULT_PUBLIC_ATTRS = {
    "bonus_round_enabled": True,
    "max_players": 10,
}

class ChampdUpConfig(GenericGameConfig):
    public: PublicConfig = DEFAULT_PUBLIC_ATTRS

class MessageType(str, Enum, metaclass=MetaEnum):
    CONNECT = "CONNECT"
    DISCONNECT = "DISCONNECT"
    START = "START"
    STOP = "STOP"
    CHAT = "CHAT"

class ChampdUp(Game):
    def __init__(self, b: Broadcast, t: Terminal) -> None:
        super().__init__(b, t)
        self.config = ChampdUpConfig()
    
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
            self.config.public[k] = v
        self.max_players = self.config.public["max_players"]
        return errors
    
    def validate_chat_msg(self, msg: MessageSchema) -> bool:
        '''Assumes `msg.type` == `MessageType.CHAT`.'''
        return type(msg.value) == str
    
    async def process_host_message(self, ws: WebSocket, msg: MessageSchema, username: int) -> ProcessedMessage:
        pm = ProcessedMessage()
        if msg.type == MessageType.CHAT:
            if self.validate_chat_msg(msg):
                pm.add_broadcast(msg.type, msg.value, 0)
        return pm
    
    async def process_plyr_message(self, ws: WebSocket, msg: MessageSchema, username: str) -> ProcessedMessage:
        pm = ProcessedMessage()
        if msg.type == MessageType.CHAT:
            if self.validate_chat_msg(msg):
                pm.add_broadcast(msg.type, msg.value, self.get_player(username).data)
        return pm