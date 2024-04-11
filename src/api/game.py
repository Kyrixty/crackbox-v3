import string

from typing import Dict, List, Any
from player import Player, create_player
from result import Result
from utils import gen_rand_hex_color, gen_rand_str
from event import Event
from pydantic import BaseModel

class GenericGameConfig(BaseModel):
    '''A generic game config.
    
    `public` -> options the host can configure\n
    `private` -> options that the host cannot configure but can be set
    by the server operator.'''
    public: dict[str, Any] = {}
    private: dict[str, Any] = {}

class Game:
    '''Treated as abstract, custom games should inherit
    from this class.'''
    def __init__(self) -> None:
        self.id = gen_rand_str(32, string.digits + string.ascii_uppercase)
        self.players: Dict[str, Player] = {}
        self.events: List[Event] = []
        self.config: GenericGameConfig = GenericGameConfig()
        self.max_players = -1
    
    def join(self, p: Player) -> Result[Player]:
        r = Result()
        if len(self.players) >= self.max_players and self.max_players != -1:
            r.Fail("Game is full!")
            return r
        if p.username in self.players:
            r.Fail("Username taken")
            return r
        self.players[p.username] = p
        r.Ok(p)
        return r
    
    def leave(self, u: str) -> Result[Player]:
        r = Result()
        if u not in self.players:
            r.Fail(f"Player not found with username {u}")
            return r
        p = self.players[u]
        del self.players[u]
        r.Ok(p)
        return r
    
    def get_public_config(self) -> dict[str, Any]:
        return self.config.public
    
    def kill(self) -> None:
        ...
    
if __name__ == "__main__":
    # Basic join/leave tests
    g = Game()
    p1 = create_player("Test", 0, gen_rand_hex_color())
    r = g.join(p1)
    print("r1,", r) # SUCCESS
    r = g.join(p1)
    print("r2,", r) # FAIL
    r = g.leave(p1)
    print("r3,", r) # SUCCESS
    r = g.leave(p1)
    print("r4,", r) # FAIL
    r = g.join(p1)
    print("r5,", r) # SUCCESS