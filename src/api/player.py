import random

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
    is_host: bool = False
    bio: str = ""
    points: int = 0
    color: str
    avatar_data_url: str = ""
    connection_status: ConnectionStatus = ConnectionStatus.DISCONNECTED

DESCRIPTORS = [
  "Loves sex on the beach",
  "Prefers baby dick over baby hands",
  "short",
  "PhD in Gayology",
  "Liberal",
  "Conservative Male",
  "I (35M) have a wife (32F). AITA?",
  "Crosses their legs regularly",
  "Infrequent Jelqer",
  "Live-Action Roleplayer",
  "Enjoys pegging (receiving end)",
  "❄️",
  "Views gay porn",
  "#LONGLIVEJANGOWU",
  "Sober",
  "Slightly larger than average boner",
  "Hates women",
  "Limp dick",
  "Commits blackface",
  "Gay --->",
  "Yung Slut",
  "Shaggee",
  "Cooks steak too long",
  "Frequents r/gooncaves",
  "Discord Mod",
  "Pregnant",
  "Loves women",
  "Fuck you.",
  "Goblin",
  "Faggot",
  "Retard",
  "👨🏿",
  "🍆🌋",
];


def create_player(username: str, points: int, color: str, is_host: bool = False) -> Player:
    return Player(username=username, bio=random.choice(DESCRIPTORS), points=points, color=color, is_host=is_host)

def get_author_as_host(conn_status: ConnectionStatus = ConnectionStatus.CONNECTED) -> Player:
    '''Returns a `Player` with `is_host` set to `True`. Note that the host is not a player,
    rather this is a lazy workaround for the message author system regarding host messages.'''
    return Player(username="Host", bio=random.choice(DESCRIPTORS), is_host=True, points=0, color="#ed5924", connection_status=conn_status)