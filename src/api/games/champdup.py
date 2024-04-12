from game import Game, GenericGameConfig, PublicConfig
from result import Result

DEFAULT_PUBLIC_ATTRS = {
    "bonus_round_enabled": True,
    "max_players": 10,
}

class ChampdUpConfig(GenericGameConfig):
    public: PublicConfig = DEFAULT_PUBLIC_ATTRS


class ChampdUp(Game):
    def __init__(self) -> None:
        super().__init__()
        self.config = ChampdUpConfig()
    
    def load_public_config(self, pub: PublicConfig) -> list[tuple[str, str]]:
        errors: list[tuple[str, str]] = []
        for k, v in pub.items():
            if k not in DEFAULT_PUBLIC_ATTRS:
                errors.append(k, "Unrecognized key")
            if k == "max_players":
                if v < 3:
                    errors.append(k, "Max players must be at least 3 (a minimum of 3 players are required to play).")
        return errors