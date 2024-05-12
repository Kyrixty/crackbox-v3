import threading
import hashlib
import random
import string
import anyio
import json

from typing import Dict, List, Any, Union, TypeVar, Literal, Generic, Callable, Tuple, Coroutine
from terminal import Terminal
from player import Player, create_player, ConnectionStatus, get_author_as_host
from result import Result
from utils import gen_rand_hex_color, gen_rand_str
from pydantic import BaseModel
from enum import Enum
from metaenum import MetaEnum
from broadcaster import Broadcast
from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from colorama import init, Fore
from globals import SIMULATE_LAG_MIN, SIMULATE_LAG_MAX, DEBUG, CONFIG_PATH
from config import Config

init(autoreset=True)
global_config = Config.load_config(CONFIG_PATH)

HOST_USERNAME = 0

Author = Player | Literal[0]

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
    STATE = "STATE",
    STATUS = "STATUS",
    PING = "PING",

T = TypeVar("T")

class MessageSchema(BaseModel, Generic[T]):
    type: DefaultMessageTypes | T
    value: Any
    author: Player | Literal[0]
    ping: float | int | None = None

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

    def add_msg(self, type: DefaultMessageTypes, val: Any, author: Author) -> None:
        self.msgs_to_send.append(MessageSchema(type=type, value=val, author=author))
    
    def add_broadcast(self, type: DefaultMessageTypes, val: Any, author: Author) -> None:
        self.msgs_to_broadcast.append(MessageSchema(type=type, value=val, author=author))

    def set_action(self, action: Callable | None) -> None:
        self.action = action

    def set_action_delay(self, delay: float) -> None:
        self.action_delay = delay
    
    def pop_next_msg_to_send(self) -> MessageSchema | None:
        return self.msgs_to_send.pop(0)
    
    def pop_next_msg_to_broadcast(self) -> MessageSchema | None:
        return self.msgs_to_broadcast.pop(0)


class Game(Generic[T]):
    '''Treated as abstract, custom games should inherit
    from this class.
    
    All derivative classes must override `get_game_state()`,
    `process_host_message()`, and `process_plyr_message()`.'''
    def __init__(self, b: Broadcast, t: Terminal) -> None:
        self.t = t
        self.log = self.t.log
        self.debug = self.t.debug
        self.info = self.t.info
        self.warn = self.t.warn
        self.error = self.t.error
        self._gen_id()
        self.players: Dict[str, Player] = {}
        self.config: GenericGameConfig = GenericGameConfig()
        self.max_players = -1
        self.status = GameStatus.WAITING
        self.host_connected = False
        self.broadcast = b
        self.ws_map: dict[str | int, WebSocket] = {}
    
    def get_game_state(self, username: str | int) -> dict[str, Any]:
        """OVERRIDE! Retrieves the current game state which is sent to
        the player/host on reconnection. Use `username` to fetch
        game state based on player name or host. Also note that there are
        3 required fields in the return value: `status` (`GameStatus`),
        `players` (`List[Player]`), and `host_connected` (`bool`). 
        You can add any number of extra fields, but these will
        need to be manually set on the frontend (game.tsx does not
        concern itself with extra fields, only the 3 required ones). 
        View the code of this function to see a correct default implementation."""
        # return {
        #     "host_connected": self.host_connected,
        #     "players": self.get_player_list(),
        #     "status": self.status,
        # }
        raise NotImplementedError("get_game_state :: You must override this method!")
    
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
    
    def has_player(self, username: str) -> bool:
        p_lower = list(self.players.keys())
        for i, v in enumerate(p_lower):
            p_lower[i] = v.lower()
        return username.lower() in p_lower

    
    def join(self, p: Player) -> Result[Player]:
        r = Result()
        if not self.can_join():
            r.Fail("Game is full!")
            return r
        if self.has_player(p.username):
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
    
    async def publish(self, type: DefaultMessageTypes | T, value: Any, author: Author) -> None:
        """Wrapper around `Game.broadcast.publish`.
        
        If `author` is 0, the message will be interpreted as a server message
        on the frontend."""
        # TODO: add logging.
        msg = MessageSchema(type=type, value=value, author=author)
        self.debug(f"Broadcasting @{self.gameId}")
        for ws in self.ws_map.values():
            await self.send(ws, msg)
        '''await self.broadcast.publish(
            channel=self.gameId,
            message=msg,
        )'''
    
    async def send(self, ws: WebSocket, msg: MessageSchema, show_ping: bool = True) -> None:
        async def do_send():
            try:
                if msg.author == 0:
                    msg.author = get_author_as_host()
                if DEBUG and global_config.simulate_ws_lag:
                    lag = random.randint(1000, 2000) # ms
                    await anyio.sleep(lag/1000)
                    if show_ping:
                        msg.ping = lag
                    await ws.send_text(msg.json())
                else:
                    await ws.send_text(msg.json())
            except RuntimeError:
                self.debug(f"{ws} is closed, consider removing from self.ws_map :: SKIPPING SEND")
        
        # Due to lag simulation, the server in DEBUG mode only with lag_simulation=True
        # will result in the server sleeping before running consecutive send results.
        # We thread `do_send` in DEBUG ONLY as a result (these threaded actions exit very soon after
        # (a max of ~SIMULATE_LAG_MAX ms after being created)) (also note that in practical
        # testing it is very hard to exceed the thread pool, as SIMULATE_LAG_MAX=120ms)

        if DEBUG and global_config.simulate_ws_lag:
            create_threaded_async_action(do_send)()
        else:
            await do_send()
    
    async def handle_ws(self, ws: WebSocket, username: str | int, wsId: str) -> None:
        self.log(f"Handling websocket {wsId}..")
        isHost = username == HOST_USERNAME
        self.ws_map[username] = ws

        if isHost:
            await self.publish(DefaultMessageTypes.HOST_CONNECT, self.get_player_list(), 0)
        else:
            if not username in self.players:
                self.debug(f"{username} could not be found in player map. Did they disconnect in the lobby?")
                await ws.close(reason="PLAYER NOT FOUND (DISCONNECTED?)")
                return
            self.players[username].connection_status = ConnectionStatus.CONNECTED
            await self.publish(DefaultMessageTypes.CONNECT, {"players": self.get_player_list(), "target": self.get_player(username).data}, 0)
        await self.send(ws, MessageSchema(type=DefaultMessageTypes.STATE, value=self.get_game_state(username), author=0))

        if not isHost:
            await self.on_player_connect(username)

        async with anyio.create_task_group() as task_group:

            async def run_ws_receiver():
                await self.ws_receiver(ws, wsId, username)
                task_group.cancel_scope.cancel()

            task_group.start_soon(run_ws_receiver)
            #self.debug("STARTING SENDER")
            #await self.ws_sender(ws, wsId, username)
        await self.disconnect(username)
        del self.ws_map[username]
        self.log(f"Finished handling {wsId}")

    async def ws_receiver(self, ws: WebSocket, wsId: str, username: str) -> None:
        """Handles incoming messages from a websocket.

        TODO: Add msg processing, currently just a msg broadcaster."""
        try:
            async for msg in ws.iter_json():
                ### Verify valid attributes
                if not "type" in msg or not "value" in msg:
                    self.log(f"Unprocessable message from {wsId} with msg={msg}")
                    await self.send_error(ws)
                else:
                    msg = MessageSchema(**msg, author=username if username == 0 else self.get_player(username).data)
                    await self.process_message(ws, msg, username)
        except RuntimeError as e:
            self.warn(f"{wsId} is closed. Error: {e}")
    
    async def process_message(self, ws: WebSocket, msg: MessageSchema, username: str | int) -> None:
        is_host = username == 0
        if is_host:
            pm = await self.process_host_message(ws, msg, username)
        else:
            pm = await self.process_plyr_message(ws, msg, username)
        for msg in pm.msgs_to_send:
            m = pm.pop_next_msg_to_send()
            await self.send(ws, MessageSchema(type=m.type, value=m.value, author=username if username == 0 else self.get_player(username).data))
        for msg in pm.msgs_to_broadcast:
            m = pm.pop_next_msg_to_broadcast()
            await self.publish(m.type, m.value, username if username == 0 else self.get_player(username).data)
            await anyio.sleep(0.05)
        if pm.action:
            if pm.action_delay > 0:
                await anyio.sleep(pm.action_delay)
            pm.action()
    
    async def process_host_message(self, ws: WebSocket, msg: MessageSchema, username: int) -> ProcessedMessage:
        raise NotImplementedError("process_host_message :: You must override this method in your custom game!")
    
    async def process_plyr_message(self, ws: WebSocket, msg: MessageSchema, username: str) -> ProcessedMessage:
        raise NotImplementedError("process_plyr_message :: You must override this method in your custom game!")
    
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
        self.debug(f"{len(self.players)}, {self.get_max_players()}")
        return (
            self.get_max_players() < 0
            or len(self.players) < self.get_max_players()
        )
    
    def can_host(self) -> bool:
        return not self.host_connected and self.status != GameStatus.STOPPED
    
    def can_play(self) -> bool:
        return self.status != GameStatus.STOPPED
    
    async def on_player_connect(self, username: str):
        ...

    async def on_player_disconnect(self, username: str):
        ...
    
    async def disconnect(self, username: str | int):
        isHost = username == HOST_USERNAME
        if isHost:
            self.host_connected = False
            self.log("The host has disconnected. Pausing game & waiting for them to reconnect.")
            await self.publish(DefaultMessageTypes.HOST_DISCONNECT, {"players": self.get_player_list()}, 0)
            return
        self.get_player(username).data.connection_status = ConnectionStatus.DISCONNECTED
        player = self.get_player(username).data.model_copy()
        if self.status == GameStatus.WAITING:
            self.debug(f"LEAVING {username}")
            await self.on_player_disconnect(username)
            self.leave(username)
        await self.publish(
            DefaultMessageTypes.DISCONNECT,
            {"players": self.get_player_list(), "target": player},
            0
        )
        self.log(f"Player '{player.username}' has left")
    
    async def kill(self) -> None:
        self.status = GameStatus.STOPPED
        await self.publish(DefaultMessageTypes.STATUS, value=self.status, author=0)
    
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