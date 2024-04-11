from api.routes.game_route import Game, GenericGameConfig

DEFAULT_PUBLIC_ATTRS = {
    "bonus_rounds": 10
}

DEFAULT_PRIVATE_ATTRS = {
    "max_players": 10
}

class Config(GenericGameConfig):
    public = DEFAULT_PUBLIC_ATTRS
    private = DEFAULT_PRIVATE_ATTRS

class MyCustomGame(Game):
    def __init__(self) -> None:
        super().__init__()
        