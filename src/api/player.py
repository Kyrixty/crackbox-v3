from pydantic import BaseModel

class Player(BaseModel):
    # Do not store confidential information in this class. If you do, make sure you edit gameRouter routes in
    # main.py to not expose it
    username: str
    points: int = 0
    color: str


def create_player(username: str, points: int, color: str) -> Player:
    return Player(username=username, points=points, color=color)