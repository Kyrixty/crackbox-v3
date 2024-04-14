import hashlib
import string
import anyio

from typing import Dict, List, Any, Union, TypeVar, Literal, Generic, Callable
from terminal import Terminal
from player import Player, create_player, ConnectionStatus
from result import Result
from utils import gen_rand_hex_color, gen_rand_str
from event import Event
from pydantic import BaseModel
from enum import Enum
from metaenum import MetaEnum
from broadcaster import Broadcast
from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from colorama import init, Fore

init(autoreset=True)

HOST_USERNAME = 0

Author = Player | Literal[0]

class GameStatus(str, Enum, metaclass=MetaEnum):
    WAITING = "WAITING"
    RUNNING = "RUNNING"
    STOPPED = "STOPPED"

class ConfigFieldType(str, Enum, metaclass=MetaEnum):
    BOOL = "BOOL"
    NUMBER = "NUMBER"
    STRING = "STRING"
    SELECT = "SELECT"

class ConfigField(BaseModel):
    name: str
    type: ConfigFieldType
    value: Union[int, str, list]

PublicConfig = dict[str, Any]
PrivateConfig = dict[str, Any]

class GenericGameConfig(BaseModel):
    '''A generic game config.
    
    `public` -> options the host can configure\n
    `private` -> options that the host cannot configure but can be set
    by the server operator.'''
    public: PublicConfig = {}
    private: PrivateConfig = {}

    def transpile_public_fields(self) -> list[ConfigField]:
        '''Converts all public fields to `ConfigField`s, which
        help the frontend determine what the type of a field is.'''
        type_fieldtype_map = {
            bool: ConfigFieldType.BOOL,
            int: ConfigFieldType.NUMBER,
            str: ConfigFieldType.STRING,
            list: ConfigFieldType.SELECT,
        }
        fields: list[ConfigField] = []
        for k, v in self.public.items():
            k: str = k # type hints don't wanna work!
            for fieldtype in type_fieldtype_map:
                if type(v) == fieldtype:
                    fields.append(ConfigField(name=k, type=type_fieldtype_map[fieldtype], value=v))
        return fields


class DefaultMessageTypes(str, Enum, metaclass=MetaEnum):
    HOST_CONNECT = "HOST_CONNECT"
    HOST_DISCONNECT = "HOST_DISCONNECT"
    CONNECT = "CONNECT"
    DISCONNECT = "DISCONNECT"
    PLAYERS = "PLAYERS"
    START = "START"
    STOP = "STOP"
    CHAT = "CHAT"

class MessageSchema(BaseModel):
    type: DefaultMessageTypes
    value: Any
    author: Player | Literal[0]

class ProcessedMessage(BaseModel):
    """Returned by process_host_message and
    process_plr_message.

    `msg_to_send` -> the message to broadcast or send back to the player.\n
    `should_broadcast` -> signals whether or not to broadcast the message.\n
    `action` -> an action to be called after broadcasting the message\n
    `action_delay` -> the amount of time to wait in seconds to wait before
    calling the action."""

    msgs_to_send: List[MessageSchema] = []
    msgs_to_broadcast: List[MessageSchema] = []
    action: Callable | None = None
    action_delay: float = 0

    def add_msg(self, type: DefaultMessageTypes, val: Any) -> None:
        self.msgs_to_send.append(MessageSchema(type=type, value=val))
    
    def add_broadcast(self, type: DefaultMessageTypes, val: Any) -> None:
        self.msgs_to_broadcast.append(MessageSchema(type=type, value=val))

    def set_action(self, action: Callable | None) -> None:
        self.action = action

    def set_action_delay(self, delay: float) -> None:
        self.action_delay = delay
    
    def pop_next_msg_to_send(self) -> MessageSchema | None:
        return self.msgs_to_send.pop(0)
    
    def pop_next_msg_to_broadcast(self) -> MessageSchema | None:
        return self.msgs_to_broadcast.pop(0)

class Game():
    '''Treated as abstract, custom games should inherit
    from this class.'''
    def __init__(self, b: Broadcast, t: Terminal) -> None:
        self.t = t
        self.log = self.t.log
        self.debug = self.t.debug
        self.info = self.t.info
        self.warn = self.t.warn
        self.error = self.t.error
        self._gen_id()
        self.players: Dict[str, Player] = {}
        self.events: List[Event] = []
        self.config: GenericGameConfig = GenericGameConfig()
        self.max_players = -1
        self.status = GameStatus.WAITING
        self.host_connected = False
        self.broadcast = b
        self.room_conns: list[WebSocket] = []
    
    def get_max_players(self) -> int:
        '''Can be overridden if max_players needs to
        be retrieved via a custom config.'''
        return self.max_players
    
    def get_player_list(self) -> list[Player]:
        return list(self.players.values())
    
    def _gen_id(self) -> None:
        id = gen_rand_str(6, string.ascii_uppercase)
        self.id = id
        self.gameId = id
    
    def join(self, p: Player) -> Result[Player]:
        r = Result()
        if len(self.players) >= self.max_players and self.max_players != -1:
            r.Fail("Game is full!")
            return r
        if p.username in self.players:
            r.Fail("Username taken")
            return r
        self.players[p.username] = p
        r.Ok(p)
        return r
    
    def leave(self, u: str) -> Result[Player]:
        r = Result()
        if u not in self.players:
            r.Fail(f"Player not found with username {u}")
            return r
        p = self.players[u]
        del self.players[u]
        r.Ok(p)
        return r
    
    def get_public_config_fields(self) -> list[ConfigField]:
        return self.config.transpile_public_fields()
    
    def load_public_config(self, pub: PublicConfig) -> list[tuple[str, str]]:
        '''Can be overridden if values need to be validated.'''
        self.config.public = pub
        return []
    
    async def publish(self, type: DefaultMessageTypes, value: Any, author: Author) -> None:
        """Wrapper around `Game.broadcast.publish`.
        
        If `author` is 0, the message will be interpreted as a server message
        on the frontend."""
        # TODO: add logging.
        msg = MessageSchema(type=type, value=value, author=author)
        self.debug(f"Broadcasting @{self.gameId} {msg}")
        for ws in self.room_conns:
            await self.send(ws, msg)
        '''await self.broadcast.publish(
            channel=self.gameId,
            message=msg,
        )'''
    
    async def send(self, ws: WebSocket, msg: MessageSchema) -> None:
        try:
            await ws.send_json(msg.dict())
        except RuntimeError:
            self.debug(f"{ws} is closed, consider removing from self.room_conns :: SKIPPING SEND")
    
    async def handle_ws(self, ws: WebSocket, username: str | int, wsId: str) -> None:
        self.log(f"Handling websocket {wsId}..")
        isHost = username == HOST_USERNAME
        self.room_conns.append(ws)

        if isHost:
            await self.publish(DefaultMessageTypes.HOST_CONNECT, self.get_player_list(), 0)
        else:
            self.players[username].connection_status = ConnectionStatus.CONNECTED
            await self.publish(DefaultMessageTypes.CONNECT, self.get_player_list(), 0)

        async with anyio.create_task_group() as task_group:

            async def run_ws_receiver():
                await self.ws_receiver(ws, wsId, username)
                task_group.cancel_scope.cancel()

            task_group.start_soon(run_ws_receiver)
            #self.debug("STARTING SENDER")
            #await self.ws_sender(ws, wsId, username)
        await self.disconnect(username)
        self.room_conns.remove(ws)
        self.log(f"Finished handling {wsId}")

    async def ws_receiver(self, ws: WebSocket, wsId: str, username: str) -> None:
        """Handles incoming messages from a websocket.

        TODO: Add msg processing, currently just a msg broadcaster."""
        async for msg in ws.iter_json():
            ### Verify valid attributes
            if not "type" in msg or not "value" in msg:
                self.log(f"Unprocessable message from {wsId} with msg={msg}")
                await self.send_error(ws)
            else:
                msg = MessageSchema(**msg, author=self.get_player(username).data)
                self.plr_msg_logs[username].append(msg)
                await self.process_message(ws, msg, username)
    
    async def ws_sender(self, ws: WebSocket, wsId: str, username: str | int) -> None:
        """Sends all events received to a websocket."""
        await ws.send_json({"HANDLE_SENDER_START": True})
        await self.send(ws, MessageSchema(type=DefaultMessageTypes.PLAYERS, value=self.get_player_list(), author=0))
        self.debug(f"{self.gameId}, {self.id}")
        async with self.broadcast.subscribe(channel=self.gameId) as subscriber:
            self.debug("SUBSCRIBED")
            # Any event published to the subscriber
            # should be broadcast to all clients.
            self.debug(str(subscriber))
            async for event in subscriber:
                self.debug("EVENT DETECTED")
                try:
                    # if type(event.message) != dict and "mType" in event.message.__dict__:
                    #     d: Dict = event.message.mType.__dict__
                    #     event.message.mType = d[list(d.keys())[0]]
                    if type(event.message) == MessageSchema:
                        m: MessageSchema = event.message
                        if m.type == self.message_type.START:
                            self.log(
                                f"{Fore.RED}START_GAME {Fore.CYAN}::{Fore.WHITE} WSID->{wsId} :: U->{username}"
                            )
                        if m.type == self.message_type.EVENT:
                            self.log(
                                f"{Fore.RED}EVENT_BROADCAST {Fore.CYAN}::{Fore.WHITE} WSID->{wsId} :: U->{username}"
                            )
                        event.message = event.message.dict()
                    self.debug(f"SENDING EVENT {event.message}")
                    await ws.send_json(event.message)
                except Exception as e:
                    print(f"{Fore.RED}FATAL (H:{username == 0}) :: {e}")
                    self.log(f"Cannot send {event.message} to WS {wsId}. Is it closed?")
    
    async def process_message(self, ws: WebSocket, msg: MessageSchema, username: str | int) -> None:
        is_host = username == 0
        if is_host:
            pm = await self._process_host_message(ws, msg, username)
        else:
            pm = await self._process_plyr_message(ws, msg, username)
        for msg in pm.msgs_to_send:
            m = pm.pop_next_msg_to_send()
            await self._send(ws, MessageSchema(type=m.type, value=m.value))
        for msg in pm.msgs_to_broadcast:
            m = pm.pop_next_msg_to_broadcast()
            await self.publish(m.type, m.value, 0)
            await anyio.sleep(0.05)
        if pm.action:
            if pm.action_delay > 0:
                await anyio.sleep(pm.action_delay)
            pm.action()
    
    async def process_host_message(self, ws: WebSocket, msg: MessageSchema, username: int) -> ProcessedMessage:
        raise NotImplementedError("You must override this method in your custom game!")
    
    async def process_plyr_message(self, ws: WebSocket, msg: MessageSchema, username: str) -> ProcessedMessage:
        raise NotImplementedError("You must override this method in your custom game!")
    
    def get_player(self, username: str) -> Result[Player]:
        r = Result()
        if username in self.players:
            r.Ok(self.players[username])
            return r
        r.Fail(f"Could not find player with username '{username}'.")
        return r
    
    async def host(self, ws: WebSocket) -> None:
        self.log(f"Now being hosted by WS {ws}")
        wsId = hashlib.sha256(str(ws).encode('utf-8')).hexdigest()
        try:
            self.host_connected = True
            await self.handle_ws(ws, 0, wsId)
        except WebSocketDisconnect:
            self.host_connected = False
            await self.disconnect(0)
        
    async def play(self, ws: WebSocket, username: str) -> None:
        self.log(f"Attempting to join {username}..")
        wsId = hashlib.sha256(str(ws).encode('utf-8')).hexdigest()
        try:
            await self.handle_ws(ws, username, wsId)
        except WebSocketDisconnect:
            await self.disconnect(username)
    
    def can_join(self) -> bool:
        return (
            self.get_max_players() == -1
            or len(self.players) < self.get_max_players()
        )
    
    def can_host(self) -> bool:
        return not self.host_connected and self.status != GameStatus.STOPPED
    
    async def disconnect(self, username: str | int):
        isHost = username == HOST_USERNAME
        if isHost:
            self.host_connected = False
            self.log("The host has disconnected. Pausing game & waiting for them to reconnect.")
            await self.publish(DefaultMessageTypes.HOST_DISCONNECT, self.get_player_list(), 0)
            return
        player = self.get_player(username).data
        if self.status == GameStatus.WAITING:
            self.leave(username)
        player.connection_status = ConnectionStatus.DISCONNECTED
        await self.publish(
            DefaultMessageTypes.DISCONNECT,
            self.get_player_list(),
            0
        )
        self.log(f"Player '{player.username}' has left")
    
    def kill(self) -> None:
        ...
    
if __name__ == "__main__":
    # Basic join/leave tests
    g = Game()
    p1 = create_player("Test", 0, gen_rand_hex_color())
    r = g.join(p1)
    print("r1,", r) # SUCCESS
    r = g.join(p1)
    print("r2,", r) # FAIL
    r = g.leave(p1)
    print("r3,", r) # SUCCESS
    r = g.leave(p1)
    print("r4,", r) # FAIL
    r = g.join(p1)
    print("r5,", r) # SUCCESS