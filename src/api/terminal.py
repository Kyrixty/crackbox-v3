import os

from pydantic import BaseModel
from colorama import init, Back
from typing import List
from enum import Enum
from globals import DEBUG

class MessageType(str, Enum):
    LOG = "LOG"
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"
    DEBUG = "DEBUG"

class TerminalOpts(BaseModel):
    can_log: bool = True
    can_info: bool = True
    can_warn: bool = True
    can_error: bool = True
    can_debug: bool = True

class TerminalMessage(BaseModel):
    type: MessageType
    msg: str

class Terminal:
    def __init__(self, opts: TerminalOpts, display_refresh_rate: float = 0.25) -> None:
        self.opts = opts
        self.refresh_rate = display_refresh_rate
        self.msgs: List[TerminalMessage] = []
        init(autoreset=True)
        self._add_msg(TerminalMessage(type=MessageType.LOG, msg="CB3 Terminal v0.1.0 now running."))

    def _display(self) -> None:
        #os.system("cls" if os.name == "nt" else "clear")
        RESET = Back.RESET
        MSG_TYPE_DATA_MAP = {
            MessageType.LOG: (Back.GREEN, "LOG"),
            MessageType.INFO: (Back.BLUE, "INFO"),
            MessageType.DEBUG: (Back.CYAN, "DEBUG"),
            MessageType.WARN: (Back.YELLOW, "WARN"),
            MessageType.ERROR: (Back.RED, "ERROR"),
        }
        for msg in self.msgs:
            data = MSG_TYPE_DATA_MAP[msg.type]
            color = data[0]
            label = data[1]

            print(f"{color}[{label}]{RESET} :: {msg.msg}")
        
    def _add_msg(self, msg: TerminalMessage) -> None:
        self.msgs.append(msg)
        self._display()

    def log(self, msg: str) -> None:
        if self.opts.can_log:
            self._add_msg(TerminalMessage(type=MessageType.LOG, msg=msg))
    
    def info(self, msg: str) -> None:
        if self.opts.can_info:
            self._add_msg(TerminalMessage(type=MessageType.INFO, msg=msg))
    
    def debug(self, msg: str) -> None:
        if DEBUG and self.opts.can_debug:
            self._add_msg(TerminalMessage(type=MessageType.DEBUG, msg=msg))
    
    def warn(self, msg: str) -> None:
        if self.opts.can_warn:
            self._add_msg(TerminalMessage(type=MessageType.WARN, msg=msg))
    
    def error(self, msg: str) -> None:
        if self.opts.can_error:
            self._add_msg(TerminalMessage(type=MessageType.ERROR, msg=msg))