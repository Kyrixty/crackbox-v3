# Crackbox 1 & 2 were never released to the public. They were test builds where I figured out how to
# not make this shit. Up to you to decide whether or not this should've been kept local too.
import random
import time
import os

from typing import Dict
from result import Result
from game import Game
from player import create_player
from utils import gen_rand_hex_color
from authx import AuthX, AuthXConfig, RequestToken, TokenPayload
from fastapi import FastAPI, Depends, Request, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from config import Config
from terminal import Terminal, TerminalOpts
from globals import DEBUG, ROOT_PATH, ENV_PATH, CONFIG_PATH
from dotenv import load_dotenv


## :: App setup
load_dotenv(ENV_PATH)

authConfig = AuthXConfig(
    JWT_ALGORITHM="HS256",
    JWT_SECRET_KEY=os.environ.get("SECRET_KEY")
)

app = FastAPI()
auth = AuthX(config=authConfig)
auth.handle_errors(app)
config = Config.load_config(CONFIG_PATH)
terminal = Terminal(TerminalOpts())
origins = [
    "http://localhost.tiangolo.com",
    "https://localhost.tiangolo.com",
    "http://localhost",
    "http://localhost:8080",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


with open(f"{ROOT_PATH}/msgs.txt", mode='r') as f:
    msgs = f.readlines()

terminal.log(f"Using config settings: {config}")

if DEBUG:
    terminal.warn("Running in DEBUG mode. May be simulating lag")

# Setup lag simulation (if set to true in config.json)
@app.middleware("http")
async def simulate_latency(request: Request, call_next):
    if not DEBUG or not config.simulate_lag:
        response = await call_next(request)
        return response
    lag = random.randint(10, 60) # ms, both ways
    time.sleep(lag/1000) # since sleep() takes seconds
    response = await call_next(request)
    time.sleep(lag/1000)
    return response

@app.route("/test")
def test():
    return "TEST PASSED"

@app.get("/menu-msg")
def get_menu_msg() -> str:
    return random.choice(msgs)

REVOKED_TOKENS = []
@auth.set_callback_token_blocklist
def is_token_revoked(token: str) -> bool:
    return token in REVOKED_TOKENS

def revoke_token(token: str) -> None:
    REVOKED_TOKENS.append(token)


# :: Game Router
game_router = APIRouter(prefix="/game")

class GameManager:
    def __init__(self) -> None:
        self.games: Dict[str, Game] = {}
    
    def game_exists(self, game_id: str) -> bool:
        return game_id in self.games

    def create_game(self) -> Game:
        '''Creates a `Game` and binds it to its id.'''
        g = Game()
        self.games[g.id] = g
        return g
    
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

def get_game(id: str) -> Game:
    res = gm.get_game(id)
    if not res.success:
        raise HTTPException(404, res.reason)
    return res.data

@game_router.put("/create")
def create_game():
    g = gm.create_game()
    return g.id

@game_router.put("/join/{id}/{username}")
def join_game(id: str, username: str):
    g = get_game(id)
    p = create_player(username, 0, gen_rand_hex_color())
    r = g.join(p)
    if not r.success:
        raise HTTPException(409, r.reason)
    token = auth.create_access_token(username, True)
    return {"access_token": token}

@game_router.put("/leave/{id}")
def leave_game(id: str, payload: TokenPayload = Depends(auth.access_token_required), token: RequestToken = Depends(auth.get_access_token_from_request)):
    g = get_game(id)
    lr = g.leave(payload.sub)
    if not lr.success:
        raise HTTPException(404, lr.reason)
    revoke_token(token.token)
    return lr.success

@game_router.get("/players/{id}")
def get_players(id: str):
    g = get_game(id)
    return list(g.players.values())

@game_router.get("/leaderboard/{id}")
def get_leaderboard(id: str):
    g = get_game(id)
    return sorted(g.players.values(), key=lambda x: x.points, reverse=True)

# :: Include routers
app.include_router(game_router)