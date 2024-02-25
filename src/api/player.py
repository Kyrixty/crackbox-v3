from pydantic import BaseModel

class Player(BaseModel):
    username: str
    points: int = 0
    color: str

def create_player(username: str, points: int, color: str) -> Player:
    return Player(username=username, points=points, color=color)