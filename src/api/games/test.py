from game import GenericGameConfig, Game, PublicConfig, PrivateConfig
from broadcaster import Broadcast
from terminal import Terminal
from typing import Any

DEFAULT_PUBLIC_ATTRS = {
    "bonus_rounds": 10,
    "value_a": "a",
    "gorge": ["opt1", "opt2", "opt3"],
    "green": True,
}

DEFAULT_PRIVATE_ATTRS = {
    "max_players": 10
}

class Config(GenericGameConfig):
    public: PublicConfig = DEFAULT_PUBLIC_ATTRS
    private: PrivateConfig = DEFAULT_PRIVATE_ATTRS

class MyCustomGame(Game):
    def __init__(self, b: Broadcast, t: Terminal) -> None:
        super().__init__(b, t)
        self.config = Config()
    
    def get_game_state(self, username: str | int) -> dict[str, Any]:
        return {
            "host_connected": self.host_connected,
            "status": self.status,
            "players": self.get_player_list(),
        }