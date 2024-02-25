import string

from typing import Dict
from player import Player, create_player
from result import Result
from utils import gen_rand_hex_color, gen_rand_str

class Game:
    def __init__(self) -> None:
        self.id = gen_rand_str(32, string.digits + string.ascii_uppercase)
        self.players: Dict[str, Player] = {}
    
    def join(self, p: Player) -> Result[Player]:
        r = Result()
        if p.username in self.players:
            return r
        self.players[p.username] = p
        r.Ok(p)
        return r
    
    def leave(self, u: str) -> Result[Player]:
        r = Result()
        if u not in self.players:
            return r
        p = self.players[u]
        del self.players[u]
        r.Ok(p)
        return r
    
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