from typing import Dict
from result import Result
from game import Game
from player import create_player
from utils import gen_rand_hex_color
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/game")

class GameManager:
    def __init__(self) -> None:
        self.games: Dict[str, Game] = {}
    
    def game_exists(self, game_id: str) -> bool:
        return game_id in self.games

    def create_game(self) -> Game:
        '''Creates a `Game` and binds it to its id.'''
        g = Game()
        self.games[g.id] = g
        return g
    
    def get_game(self, game_id: str) -> Result[Game]:
        '''Returns a `Result` which, if successful, has
        data set to the game queried.'''
        r = Result()
        if not self.game_exists(game_id):
            r.Fail(f"No game found with ID: {game_id}")
            return r
        r.Ok(self.games[game_id])
        return r

    def kill_game(self, id: str) -> Game:
        '''Kills a `Game` instance and removes it
        from the GAMEID->GAME bindings.'''
        self.games[id].kill()
        del self.games[id]

gm = GameManager()

def get_game(id: str) -> Game:
    res = gm.get_game(id)
    if not res.success:
        raise HTTPException(404, res.reason)
    return res.data

@router.put("/create")
def create_game():
    g = gm.create_game()
    return g.id

@router.put("/join/{id}/{username}")
def join_game(id: str, username: str):
    g = get_game(id)
    p = create_player(username, 0, gen_rand_hex_color())
    r = g.join(p)
    if not r.success:
        raise HTTPException(409, r.reason)
    return r.success

@router.put("/leave/{id}/{username}")
def leave_game(id: str, username: str):
    g = get_game(id)
    lr = g.leave(username)
    if not lr.success:
        raise HTTPException(404, lr.reason)
    return lr.success