import string

from typing import Dict, List, Any, Union
from player import Player, create_player
from result import Result
from utils import gen_rand_hex_color, gen_rand_str
from event import Event
from pydantic import BaseModel
from enum import Enum
from metaenum import MetaEnum

class ConfigFieldType(str, Enum, metaclass=MetaEnum):
    BOOL = "BOOL"
    NUMBER = "NUMBER"
    STRING = "STRING"
    SELECT = "SELECT"

class ConfigField(BaseModel):
    name: str
    type: ConfigFieldType
    value: Union[int, str, list]

PublicConfig = dict[str, Any]
PrivateConfig = dict[str, Any]

class GenericGameConfig(BaseModel):
    '''A generic game config.
    
    `public` -> options the host can configure\n
    `private` -> options that the host cannot configure but can be set
    by the server operator.'''
    public: PublicConfig = {}
    private: PrivateConfig = {}

    def transpile_public_fields(self) -> list[ConfigField]:
        '''Converts all public fields to `ConfigField`s, which
        help the frontend determine what the type of a field is.'''
        type_fieldtype_map = {
            bool: ConfigFieldType.BOOL,
            int: ConfigFieldType.NUMBER,
            str: ConfigFieldType.STRING,
            list: ConfigFieldType.SELECT,
        }
        fields: list[ConfigField] = []
        for k, v in self.public.items():
            k: str = k # type hints don't wanna work!
            for fieldtype in type_fieldtype_map:
                if type(v) == fieldtype:
                    fields.append(ConfigField(name=k, type=type_fieldtype_map[fieldtype], value=v))
        return fields

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
    
    def get_public_config_fields(self) -> list[ConfigField]:
        return self.config.transpile_public_fields()
    
    def load_public_config(self, pub: PublicConfig) -> list[tuple[str, str]]:
        '''Can be overridden if values need to be validated.'''
        self.config.public = pub
    
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