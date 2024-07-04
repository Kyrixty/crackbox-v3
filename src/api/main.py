# Crackbox 1 & 2 were never released to the public. They were test builds where I figured out how to
# not make this shit. Up to you to decide whether or not this should've been kept local too.
import urllib.request
import random
import base64
import hashlib
import uvicorn
import string
import json
import time
import os
import io

from typing import Dict, Any, Type, Callable
from fastapi.types import DecoratedCallable
from result import Result
from game import Game, GameStatus
from player import create_player, DESCRIPTORS
from utils import gen_rand_hex_color, gen_rand_str
from authx import AuthX, AuthXConfig, RequestToken, TokenPayload
from fastapi import FastAPI, Depends, Request, APIRouter as FastAPIRouter, HTTPException, WebSocket
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from config import Config
from terminal import Terminal, TerminalOpts
from globals import DEBUG, ROOT_PATH, ENV_PATH, CONFIG_PATH, MAX_USERNAME_LENGTH, SIMULATE_LAG_MAX, SIMULATE_LAG_MIN
from dotenv import load_dotenv
from enum import Enum
from metaenum import MetaEnum
from games.champdup import ChampdUp, ChampdUpConfig
from games.test_multi_draw import TestMultiDraw
from games.test import MyCustomGame
from pydantic import BaseModel
from broadcaster import Broadcast
from binascii import a2b_base64
from PIL import Image
from datauri import DataURI


## :: App setup
load_dotenv(ENV_PATH)

authConfig = AuthXConfig(
    JWT_ALGORITHM="HS256",
    JWT_SECRET_KEY=os.environ.get("SECRET_KEY")
)

class APIRouter(FastAPIRouter):
    def api_route(
        self, path: str, *, include_in_schema: bool = True, **kwargs: Any
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        if path.endswith("/"):
            path = path[:-1]

        add_path = super().api_route(
            path, include_in_schema=include_in_schema, **kwargs
        )

        alternate_path = path + "/"
        add_alternate_path = super().api_route(
            alternate_path, include_in_schema=False, **kwargs
        )

        def decorator(func: DecoratedCallable) -> DecoratedCallable:
            add_alternate_path(func)
            return add_path(func)

        return decorator

app = FastAPI()
broadcast = Broadcast("memory://")
auth = AuthX(config=authConfig)
auth.handle_errors(app)
config = Config.load_config(CONFIG_PATH)
terminal = Terminal(TerminalOpts())
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_headers=["Origin, Content-Type, Accept, Authorization"],
    allow_methods=["*"],
    expose_headers=["*"],
)

main_router = APIRouter()

# :: Game map
class GameName(str, Enum, metaclass=MetaEnum):
    CHAMPDUP = "Champ'd Up"
    TESTMULTIDRAW = "TEST MULTI DRAW"
    TEST = "TEST"

game_name_map: dict[GameName, Type[Game]] = {
    GameName.CHAMPDUP: ChampdUp,
}


with open(f"{ROOT_PATH}/msgs.txt", mode='r') as f:
    msgs = f.readlines()

terminal.log(f"Using config settings: {config}")

if DEBUG:
    terminal.warn("Running in DEBUG mode. May be simulating lag")

# Setup lag simulation (if set to true in config.json and DEBUG=true)
@app.middleware("http")
async def simulate_latency(request: Request, call_next):
    if not DEBUG or not config.simulate_http_lag:
        response = await call_next(request)
        return response
    lag = random.randint(SIMULATE_LAG_MIN, SIMULATE_LAG_MAX) # ms, both ways
    time.sleep(lag/1000) # since sleep() takes seconds
    response = await call_next(request)
    time.sleep(lag/1000)
    return response

@main_router.route("/test")
def test():
    return "TEST PASSED"

@main_router.get("/menu-msg/")
@main_router.get("/menu-msg")
def get_menu_msg() -> str:
    return random.choice(msgs)

REVOKED_TOKENS = []
WS_TICKET_MAP: dict[str, dict[str, str | int]] = {}
@auth.set_callback_token_blocklist
def is_token_revoked(token: str) -> bool:
    return token in REVOKED_TOKENS

def revoke_token(token: str) -> None:
    REVOKED_TOKENS.append(token)

def create_ws_ticket(username: str | int, gameId: str) -> str:
    def get_ticket() -> str: return gen_rand_str(32, string.ascii_letters + string.digits)
    ticket = get_ticket()
    if gameId not in WS_TICKET_MAP:
        WS_TICKET_MAP[gameId] = {}
    while ticket in WS_TICKET_MAP[gameId]:
        ticket = get_ticket()
    WS_TICKET_MAP[gameId][ticket] = username
    return ticket

def resolve_ws_ticket(ticket: str, gameId: str) -> Result[str | int]:
    r = Result[str | int]()
    if gameId not in WS_TICKET_MAP:
        r.Fail("Invalid gameId.")
        return r
    if ticket not in WS_TICKET_MAP[gameId]:
        r.Fail("Invalid ticket.")
        return r
    r.Ok(WS_TICKET_MAP[gameId][ticket])
    return r


# :: Game Router

game_router = APIRouter(prefix="/game")

class GameManager:
    def __init__(self) -> None:
        self.games: Dict[str, Game] = {}
    
    def game_exists(self, game_id: str) -> bool:
        return game_id in self.games

    def create_game(self, name: GameName, config: dict[str, Any]) -> Result[Game]:
        '''Creates a `Game` and binds it to its id.'''
        r = Result()
        if name not in game_name_map:
            r.Fail(f"Game with name '{name}' not found.")
            return r
        g = game_name_map[name](broadcast, terminal)
        errs = g.load_public_config(config)
        if not len(errs):
            # Generate unique ID
            while g.id in self.games:
                g._gen_id()
            self.games[g.id] = g
            r.Ok(g)
            return r
        r.Fail(json.dumps(errs))
        return r
    
    def get_game(self, game_id: str) -> Result[Game]:
        '''Returns a `Result` which, if successful, has
        data set to the game queried.'''
        r = Result()
        if not self.game_exists(game_id):
            r.Fail(f"No game found with ID: {game_id}")
            return r
        r.Ok(self.games[game_id])
        return r

    def kill_game(self, id: str) -> Game:
        '''Kills a `Game` instance and removes it
        from the GAMEID->GAME bindings.'''
        self.games[id].kill()
        del self.games[id]

gm = GameManager()

# TEST_MULTIDRAW_ID = ""

# if DEBUG:
#     TEST_MULTIDRAW_ID = gm.create_game(GameName.TESTMULTIDRAW, {}).data.id

def get_game(id: str) -> Game:
    res = gm.get_game(id)
    if not res.success:
        raise HTTPException(404, res.reason)
    return res.data

class GameCreatePayload(BaseModel):
    config: dict[str, Any]

class GameCreateResponse(BaseModel):
    id: str
    access_token: str
    ticket: str

@game_router.post("/create/{name}")
def create_game(name: str, config: GameCreatePayload):
    r: Result[Game] = gm.create_game(name, config.config)
    if not r.success:
        code = 404 if r.reason == f"Game with name '{name}' not found." else 400
        raise HTTPException(code, r.reason)
    token = auth.create_access_token(f"0_{r.data.id}")
    ticket = create_ws_ticket(0, r.data.id)
    return GameCreateResponse(
        id=r.data.id,
        access_token=token,
        ticket=ticket,
    )

def pillow_image_to_base64_string(img) -> str:
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")

class GameJoinPayload(BaseModel):
    avatar_data_url: str

IMAGE_COMPRESSION_QUALITY = 1

@game_router.put("/join/{id}/{username}")
def join_game(id: str, username: str, payload: GameJoinPayload):
    g = get_game(id)
    if len(username) == 0 or len(username) > MAX_USERNAME_LENGTH:
        raise HTTPException(403, "Username must be at least 1 character and at most 24 characters.")
    username = username.strip()
    if g.has_player(username):
        raise HTTPException(409, "Username taken!")
    if payload.avatar_data_url:
        file_name = f"{id}-{username}.png"
        path = f"{ROOT_PATH}/imgs/{file_name}"
        response = urllib.request.urlopen(payload.avatar_data_url)
        with open(path, "wb") as f:
            f.write(response.file.read())
        try:
            im = Image.open(path)
        except Exception as e:
            terminal.debug(str(e))
            raise HTTPException(400, "Data URI is invalid, please ensure it is an encoded image")
        im = im.resize((300, 300), Image.LANCZOS)
        im.save(path, "png", quality=IMAGE_COMPRESSION_QUALITY)
        im = Image.open(path)
        base = "https://www.gaybaby.ca/api" # "http://localhost:8000"
        payload.avatar_data_url = f"{base}/game/players/{id}/{username}/avatar"
    p = create_player(username, 0, gen_rand_hex_color(), avatar_data_url=payload.avatar_data_url)
    r = g.join(p)
    if not r.success:
        raise HTTPException(409, r.reason)
    token = auth.create_access_token(username, True)
    ticket = create_ws_ticket(username, g.id)
    return {"access_token": token, "ticket": ticket}

@game_router.get("/players/{id}/{username}/avatar", response_class=FileResponse)
def get_player_avatar(id: str, username: str):
    fp = f"{ROOT_PATH}/imgs/{id}-{username}.png"
    if not os.path.isfile(fp):
        raise HTTPException(404, "Could not find avatar!")
    return FileResponse(fp, media_type="image/png")

@game_router.get("/players/{id}")
def get_players(id: str):
    g = get_game(id)
    return list(g.players.values())

@game_router.get("/leaderboard/{id}")
def get_leaderboard(id: str):
    g = get_game(id)
    return sorted(g.players.values(), key=lambda x: x.points, reverse=True)

@game_router.get("/fields/{name}")
def get_game_fields(name: GameName):
    if name not in GameName:
        raise HTTPException(404, f"Unknown game name '{name}'.")
    g: Game = game_name_map[name](broadcast, terminal)
    return g.get_public_config_fields()

@game_router.get("/names")
def get_game_names() -> list[str]:
    return list(game_name_map.keys())

@game_router.get("/config/{id}")
def get_game_public_config(id: str):
    # TODO (future RT): Should require host JWT token
    g = get_game(id)
    return g.config.public

class GameError(str, Enum, metaclass=MetaEnum):
    GAME_NOT_FOUND = "GAME NOT FOUND"
    GAME_NOT_OPEN = "GAME NOT OPEN"
    INVALID_TICKET = "INVALID TICKET"
    BAD_ROUTE = "BAD ROUTE"

async def check_websocket(ws: WebSocket, gameId: str, route_is_host: bool, ticket: str) -> bool:
    """Returns `True` if the client
    is trying to connect/host a valid
    game."""
    await ws.accept()
    if not gm.game_exists(gameId):
        await ws.close(reason=GameError.GAME_NOT_FOUND)
        return False
    r = resolve_ws_ticket(ticket, gameId)
    if not r.success:
        await ws.close(reason=GameError.INVALID_TICKET)
        return False
    is_host = r.data == 0
    if is_host != route_is_host:
        await ws.close(reason=GameError.BAD_ROUTE)
        return False
    game = gm.get_game(gameId).data
    if is_host and not game.can_host() or not is_host and not game.can_play():
        await ws.close(reason=GameError.GAME_NOT_OPEN)
        return False
    return True

@game_router.get("/can-reconnect/{gameId}/{ticket}")
def can_play(gameId: str, ticket: str):
    g = get_game(gameId);
    if g.status != GameStatus.RUNNING:
        raise HTTPException(403, "Game is not running!")
    r = resolve_ws_ticket(ticket, gameId)
    if not r.success:
        raise HTTPException(404, r.reason)
    return {"is_host": r.data == 0}


@game_router.websocket("/host/{gameId}/{ticket}")
async def host_game(ws: WebSocket, gameId: str, ticket: str):
    success = await check_websocket(ws, gameId, True, ticket)
    if not success:
        return
    game = get_game(gameId)
    await game.host(ws)


@game_router.websocket("/play/{gameId}/{ticket}")
async def join_game(ws: WebSocket, gameId: str, ticket: str):
    success = await check_websocket(ws, gameId, False, ticket)
    if not success:
        return
    game = get_game(gameId)
    await game.play(ws, resolve_ws_ticket(ticket, gameId).data)

tmd_ctr = 0

# @game_router.websocket("/test-multi-draw")
# async def test_multi_draw(ws: WebSocket):
#     # No validation required for ws
#     global tmd_ctr
#     tmd_ctr += 1
#     if not DEBUG:
#         return
#     game = get_game(TEST_MULTIDRAW_ID)
#     username = f"P_{tmd_ctr}"
#     p = create_player(username, 20, "")
#     r = game.join(p)
#     print(r.reason, r.data)
#     await ws.accept()
#     await game.play(ws, username)

# :: Include routers
app.include_router(main_router)
app.include_router(game_router)

if __name__ == "__main__":
    uvicorn.run(app)