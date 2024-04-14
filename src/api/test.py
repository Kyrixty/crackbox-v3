import requests
import json
import os

from pydantic import BaseModel
from globals import CONFIG_TEST_PATH
from typing import Tuple, List, Callable, Dict
from terminal import Terminal, TerminalOpts
from event import Event, Store

t = Terminal(TerminalOpts())

class Config(BaseModel):
    host: str = "http://localhost"
    port: int = 8000

class SuccessiveTests(BaseModel):
    '''A test may only run if the previous test was successful.'''
    tests: List[Callable[[], bool]]

    def run_tests(self, config: Config) -> Tuple[int, int]:
        successful_tests = 0
        for test in self.tests:
            success = False
            try:
                success = test()
            except Exception as e:
                t.error(f"{test.__name__} encountered an exception during testing: {e}")
            successful_tests += success
            if not success:
                if successful_tests < len(self.tests):
                    t.warn(f"Test cluster finished early: {successful_tests} successful, {len(self.tests)} total")
                return successful_tests, len(self.tests)
        return successful_tests, len(self.tests)
    

def load_test_config() -> Config:
    c = Config()
    if not os.path.isfile(CONFIG_TEST_PATH):
        print(f"Test config not found under path {CONFIG_TEST_PATH}, creating default config..")
        with open(CONFIG_TEST_PATH, mode="w") as f:
            f.write(c.json())
        print(f"Test config successfully created")

    print("Loading test config..")
    with open(CONFIG_TEST_PATH, mode="r") as f:
        c = Config(**json.loads(f.read()))
    print("Test config loaded")
    return c

def get_url(config: Config, suffix_path: str) -> str:
    suffix_path = suffix_path.removeprefix("/")
    return f"{config.host}:{config.port}/{suffix_path}"

def test_game_creation(config: Config) -> Tuple[int, int]:
    t.warn("Testing game creation cluster, note that the server must be running and config host and port must be set correctly for tests to pass.")
    def _get_url(suffix_path: str) -> str:
        return get_url(config, suffix_path)
    def test_game_create() -> bool:
        t.log("Testing game creation")
        r = requests.post(_get_url("/game/create/TEST"), json={"config": {}})
        return r.ok
    def test_game_join() -> bool:
        t.log("Testing game join")
        r = requests.post(_get_url("/game/create/TEST"), json={"config": {}})
        r = requests.put(_get_url(f"/game/join/{str(r.json()['id'])}/test"))
        return r.ok
    def test_game_players_and_leaderboard() -> bool:
        t.log("Testing game players & leaderboard")
        r = requests.post(_get_url(f"/game/create/TEST"), json={"config": {}})
        gid = str(r.json()['id'])
        NUM_JOINS = 5
        token_map = {}
        for i in range(NUM_JOINS):
            r = requests.put(_get_url(f"/game/join/{gid}/{i}"))
            token_map[str(i)] = r.json()["access_token"]
        players = requests.get(_get_url(f"/game/players/{gid}")).json()
        leaderboard = requests.get(_get_url(f"/game/leaderboard/{gid}")).json()
        players, leaderboard = sorted(players, key=lambda x: x["username"]), sorted(leaderboard, key=lambda x: x["username"])
        l1, l2 = len(players), len(leaderboard)
        return l1 == l2 and [p["username"] for p in players] == [p["username"] for p in leaderboard]

    s = SuccessiveTests(tests=[test_game_create, test_game_join, test_game_players_and_leaderboard])
    return s.run_tests(config)

def test_event_store(config: Config) -> Tuple[int, int]:
    dm: Dict[str, Event] = {}

    class CustomEventA(Event[int]):
        def start(self, data_collected) -> None:
            self.data = 5
            self.success = bool(data_collected['B'])
        def stop(self) -> bool: return self.success
    
    class CustomEventB(Event[str]):
        def start(self, data_collected) -> None:
            self.data = "abc"
            self.dc = data_collected
            g = self.dc["A"].data
            self.success = g == 5
        def stop(self) -> bool: return self.success
    a, b = CustomEventA("A"), CustomEventB("B")
    t.log("Testing event store")
    num_correct = 0
    total = 2
    dm["A"] = a
    dm["B"] = b
    a.start(dm)
    num_correct += a.stop()
    b.start(dm)
    num_correct += b.stop()
    return num_correct, total
    

def do_tests(config: Config) -> Tuple[int, int]:
    '''Returns number of tests correct, total number of tests'''
    # Test game creation
    TESTS = [
        test_game_creation,
        test_event_store,
    ]

    t.log("Running tests")
    num_correct = 0
    total = 0
    for test in TESTS:
        r = test(config)
        num_correct += r[0]
        total += r[1]
    if num_correct < total:
        t.warn("CAREFUL! Not all tests passed!")
    t.info(f"Tests finished, {num_correct} correct, {total} total")

def main() -> None:
    config = load_test_config()
    do_tests(config)

if __name__ == "__main__":
    main()