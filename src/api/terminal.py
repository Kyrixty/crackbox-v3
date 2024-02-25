import os

from pydantic import BaseModel
from colorama import init, Back
from typing import List
from enum import Enum

class MessageType(str, Enum):
    LOG = "LOG"
    WARN = "WARN"
    ERROR = "ERROR"
    DEBUG = "DEBUG"

class TerminalOpts(BaseModel):
    can_log: bool = True
    can_warn: bool = True
    can_error: bool = True
    can_debug: bool = True

class TerminalMessage(BaseModel):
    type: MessageType
    msg: str

class Terminal:
    def __init__(self, opts: TerminalOpts, display_refresh_rate: float = 0.25) -> None:
        self.opts = TerminalOpts
        self.refresh_rate = display_refresh_rate
        self.msgs: List[TerminalMessage] = []
        init(autoreset=True)
        self._add_msg(TerminalMessage(type=MessageType.LOG, msg="CB3 Terminal v0.1.0 now running."))

    def _display(self) -> None:
        os.system("cls" if os.name == "nt" else "clear")
        RESET = Back.RESET
        MSG_TYPE_COLOR_MAP = {
            MessageType.LOG: Back.GREEN,
            MessageType.DEBUG: Back.BLUE,
            MessageType.WARN: Back.YELLOW,
            MessageType.ERROR: Back.RED,
        }
        for msg in self.msgs:
            color = MSG_TYPE_COLOR_MAP[msg.type]
            print(f"{color}[LOG]{RESET} :: {msg.msg}")
        
    def _add_msg(self, msg: TerminalMessage) -> None:
        self.msgs.append(msg)
        self._display()

    def log(self, msg: str) -> None:
        self._add_msg(TerminalMessage(type=MessageType.LOG, msg=msg))
    
    def debug(self, msg: str) -> None:
        self._add_msg(TerminalMessage(type=MessageType.DEBUG, msg=msg))
    
    def warn(self, msg: str) -> None:
        self._add_msg(TerminalMessage(type=MessageType.WARN, msg=msg))
    
    def error(self, msg: str) -> None:
        self._add_msg(TerminalMessage(type=MessageType.ERROR, msg=msg))