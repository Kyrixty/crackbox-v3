# Crackbox 1 & 2 were never released to the public. They were test builds where I figured out how to
# not make this shit. Up to you to decide whether or not this should've been kept local too.
import game_route

from fastapi import FastAPI
from config import Config
from terminal import Terminal, TerminalOpts
from globals import CONFIG_PATH

app = FastAPI()
config = Config.load_config(CONFIG_PATH)
terminal = Terminal(TerminalOpts())

@app.route("/test")
def test():
    return "TEST PASSED"

app.include_router(game_route.router)