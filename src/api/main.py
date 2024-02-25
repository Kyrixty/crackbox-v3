import uvicorn

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