from pydantic import BaseModel
from enum import Enum
from metaenum import MetaEnum

class ConnectionStatus(str, Enum, metaclass=MetaEnum):
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"

class Player(BaseModel):
    # Do not store confidential information in this class. If you do, make sure you edit gameRouter routes in
    # main.py to not expose it
    username: str
    points: int = 0
    color: str
    avatar_data_url: str = ""
    connection_status: ConnectionStatus = ConnectionStatus.DISCONNECTED


def create_player(username: str, points: int, color: str) -> Player:
    return Player(username=username, points=points, color=color)