import json
from pydantic import BaseModel

class Config(BaseModel):
    simulate_lag: bool = False

    def save_config(self, config_path: str) -> None:
        with open(config_path, mode="w") as f:
            f.write(self.json())
    
    @classmethod
    def load_config(cls, config_path: str) -> "Config":
        with open(config_path, mode="r") as f:
            return Config(**json.loads(f.read()))