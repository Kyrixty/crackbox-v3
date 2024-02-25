import os
import time

from threading import Thread, Lock
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
        self.msgs: List[TerminalMessage] = [TerminalMessage(type=MessageType.LOG, msg="CB3 Terminal v0.1.0, now running.")]
        self.running = False
        self.lock = Lock()

    def display(self) -> None:
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
        
    def add_msg(self, msg: TerminalMessage) -> None:
        with self.lock:
            self.msgs.append(msg)

    def log(self, msg: str) -> None:
        self.add_msg(TerminalMessage(type=MessageType.LOG, msg=msg))
    
    def debug(self, msg: str) -> None:
        self.add_msg(TerminalMessage(type=MessageType.DEBUG, msg=msg))
    
    def warn(self, msg: str) -> None:
        self.add_msg(TerminalMessage(type=MessageType.WARN, msg=msg))
    
    def error(self, msg: str) -> None:
        self.add_msg(TerminalMessage(type=MessageType.ERROR, msg=msg))
    
    def kill(self) -> None:
        self.running = False
        self.__terminal_thread.join()
    
    def run(self) -> None:
        self.running = True
        self.__terminal_thread = Thread(target=self._run)
        self.__terminal_thread.start()

    def _run(self) -> None:
        init(autoreset=True)
        while self.running:
            try:
                self.display()
                time.sleep(self.refresh_rate)
            except KeyboardInterrupt:
                self.kill()