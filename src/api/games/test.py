from game import GenericGameConfig, Game, PublicConfig, PrivateConfig

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
    def __init__(self) -> None:
        super().__init__()
        self.config = Config()
        