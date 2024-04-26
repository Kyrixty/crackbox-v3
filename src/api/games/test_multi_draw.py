import datetime

from game import Game, ProcessedMessage, MessageSchema
from fastapi import WebSocket
from broadcaster import Broadcast
from terminal import Terminal
from metaenum import MetaEnum
from enum import Enum

class MessageType(str, Enum, metaclass=MetaEnum):
    DRAW_READY = "draw-ready"
    DRAW_DATA = "draw-data"
    DRAW_CLEAR = "draw-clear"
    DRAW_UNDO = "draw-undo"

class TestMultiDraw(Game):
    def __init__(self, b: Broadcast, t: Terminal) -> None:
        super().__init__(b, t)
        self.receivable: set[str] = set()
        self.last_data_uri: str | None = None

    def get_game_state(self, username: str | int):
        # Get player's team, validate connection, etc
        self.host_connected = True
        return {
            "host_connected": self.host_connected,
            "players": self.get_player_list(),
            "status": self.status,
            "cduri": self.last_data_uri
        }

    async def on_player_disconnect(self, username: str):
        if username in self.receivable:
            self.receivable.remove(username)

    async def process_host_message(self, ws: WebSocket, msg: MessageSchema, username: int) -> ProcessedMessage:
        # No host messages are processed as there isn't a host for this game.
        pm = ProcessedMessage()
        return pm
    
    async def process_plyr_message(self, ws: WebSocket, msg: MessageSchema, username: str) -> ProcessedMessage:
        pm = ProcessedMessage()
        if msg.type == MessageType.DRAW_READY:
            self.receivable.add(username)
        if msg.type == MessageType.DRAW_CLEAR:
            self.last_data_uri = None
            for u in self.ws_map:
                if u == username:
                    continue
                await self.send(self.ws_map[u], MessageSchema(type=MessageType.DRAW_CLEAR, value=None, author=self.get_player(username).data))
        if msg.type == MessageType.DRAW_DATA:
            v = msg.value
            if "title" in v and "path" in v and "dUri" in v:
                self.last_data_uri = v["dUri"]
                v["timestamp"] = datetime.datetime.now().isoformat()
                for u in self.ws_map:
                    if u == username:
                        continue
                    await self.send(self.ws_map[u], MessageSchema(type=MessageType.DRAW_DATA, value=v, author=self.get_player(username).data))
        return pm
    
    def can_join(self) -> bool:
        return True