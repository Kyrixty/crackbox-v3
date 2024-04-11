# Crackbox 1 & 2 were never released to the public. They were test builds where I figured out how to
# not make this shit. Up to you to decide whether or not this should've been kept local too.
import routes.game_route
import random

from fastapi import FastAPI
from config import Config
from terminal import Terminal, TerminalOpts
from globals import ROOT_PATH, CONFIG_PATH

app = FastAPI()
config = Config.load_config(CONFIG_PATH)
terminal = Terminal(TerminalOpts())
with open(f"{ROOT_PATH}/msgs.txt", mode='r') as f:
    msgs = f.readlines()

@app.route("/test")
def test():
    return "TEST PASSED"

@app.get("/menu-msg")
def get_menu_msg() -> str:
    return random.choice(msgs)

app.include_router(routes.game_route.router)