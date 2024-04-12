from api.game import GenericGameConfig, Game, PublicConfig, PrivateConfig

DEFAULT_PUBLIC_ATTRS = {
    "bonus_rounds": 10
}

DEFAULT_PRIVATE_ATTRS = {
    "max_players": 10
}

class Config(GenericGameConfig):
    public: PublicConfig = DEFAULT_PUBLIC_ATTRS
    private: PrivateConfig = DEFAULT_PRIVATE_ATTRS

class MyCustomGame(Game):
    def __init__(self) -> None:
        super().__init__()
        