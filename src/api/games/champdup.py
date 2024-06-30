import datetime
import hashlib
import inspect
import anyio
import threading
import random
import math
import os

from game import Game, GenericGameConfig, PublicConfig, MessageSchema, ProcessedMessage, GameStatus, create_threaded_async_action
from result import Result
from broadcaster import Broadcast
from fastapi import WebSocket
from enum import Enum
from metaenum import MetaEnum
from terminal import Terminal
from typing import Literal, Any, Coroutine, Callable, Tuple
from pydantic import BaseModel
from globals import MAX_USERNAME_LENGTH, DEBUG
from fuzzywuzzy import fuzz
from player import Player

DEFAULT_PUBLIC_ATTRS = {
    "max_players": 10,
    "bonus_round_enabled": False,
    "polls_enabled": True,
    "poll_duration": 10,
    "host_only_polls": False,
    "enable_private_messages": True,
    "draw_duration": 120,
    "vote_duration": 10,
    "force_next_event_after_all_images_received": True,
    "custom_prompts": "",
    "custom_prompts_only": False, 
}

task_threads = []
task_threads_lock = threading.Lock()

class Timer:
    def __init__(self, name: str, t: Terminal, callback: Coroutine | Callable | None = None) -> None:
        self.name = name
        self.callback = callback
        self.finished = False
        self.t = t
        self.log = t.log

    async def run(self, ends: datetime.datetime, *args: Tuple) -> None:
        duration = (ends - datetime.datetime.now()).total_seconds()
        self.log(f"Sleeping for {duration} seconds")
        with task_threads_lock:
            self.finished = False
        await anyio.sleep(duration)
        self.log(f"Finished sleeping")
        with task_threads_lock:
            if self.finished: # killed at some point before duration was reached
                return
            if not self.finished:
                self.finished = True
        if self.callback:
            if inspect.iscoroutinefunction(self.callback):
                self.log("Awaiting callback")
                self.t.debug(str(args))
                await self.callback(*args)
            else:
                self.log("Calling callback")
                self.callback(*args)
        self.log("Timer finished.")

    async def start(self, ends: datetime.datetime, *args: Tuple) -> None:
        with task_threads_lock:
            self.finished = False
        create_threaded_async_action(self.run, (ends, *args))()

    def kill(self) -> None:
        with task_threads_lock:
            self.finished = True

class ChampdUpConfig(GenericGameConfig):
    public: PublicConfig = DEFAULT_PUBLIC_ATTRS

# : MessageTypes
class MessageType(str, Enum, metaclass=MetaEnum):
    STATE = "STATE"
    STATUS = "STATUS"
    CHAT = "CHAT"
    POLL = "POLL"
    POLL_VOTE = "POLL_VOTE"
    SPONSOR = "SPONSOR"
    PM = "PM"
    NOTIFY = "NOTIFY"
    IMAGE = "IMAGE"
    IMAGE_SUBMITS = "IMAGE_SUBMITS"
    IMAGE_SWAP = "IMAGE_SWAP" # Not available in bonus round
    MATCHUP = "MATCHUP"
    MATCHUP_VOTE = "MATCHUP_VOTE"
    MATCHUP_RESULT = "MATCHUP_RESULT"
    MATCHUP_START = "MATCHUP_START"

class NotifyType(str, Enum, metaclass=MetaEnum):
    SUCCESS = "SUCCESS"
    FAIL = "FAIL"
    INFO = "INFO"

class Poll(BaseModel):
    ends: str
    prompt: str
    yes: set[str]
    no: set[str]

    def is_active(self) -> bool:
        return datetime.datetime.fromisoformat(self.ends) > datetime.datetime.now()

class Image(BaseModel):
    title: str
    dUri: str | None = None
    artists: list[Player]
    prompt: str
    last_changed: str | None = None

class AwardName(str, Enum, metaclass=MetaEnum):
    DOMINATION = "DOMINATION"
    ON_FIRE = "ON_FIRE"
    BRUH = "BRUH"
    PRIDE = "PRIDE"
    COMEBACK = "COMEBACK"
    FAST = "FAST"

class Award(BaseModel):
    name: AwardName
    bonus: int

class ImageMatchup(BaseModel):
    left: Image
    leftVotes: set[str]
    right: Image
    rightVotes: set[str]
    initial_leader: str | None = None
    started: bool = False

    def add_vote(self, username: str, target: Literal["left", "right"]):
        if not self.initial_leader:
            self.initial_leader = target
        if target == "left":
            if username in self.rightVotes:
                self.rightVotes.remove(username)
            self.leftVotes.add(username)
        elif target == "right":
            if username in self.leftVotes:
                self.leftVotes.remove(username)
            self.rightVotes.add(username)

# : Managers

class MatchupManager:
    def __init__(self) -> None:
        self._idx = -1
        self.matchups: list[ImageMatchup] = []
        self.voting_enabled = False
    
    def has_started(self) -> bool:
        return self._idx != -1
    
    def has_ended(self) -> bool:
        return self._idx >= len(self.matchups)
    
    def enable_voting(self) -> None:
        self.voting_enabled = True
    
    def disable_voting(self) -> None:
        self.voting_enabled = False
    
    def next_matchup(self):
        '''Disables voting'''
        self._idx += 1
        self.voting_enabled = False
    
    def get_matchup(self):
        return self.matchups[self._idx]
    
    def add_matchup(self, left: Image, right: Image):
        self.matchups.append(ImageMatchup(left=left, right=right, leftVotes=set(), rightVotes=set()))
    
    def reset(self):
        self._idx = -1
        self.matchups = []
    
dirname = os.path.dirname(__file__)
with open(f"{dirname}/champdup-prompts.txt", mode="r") as f:
    prompts = [l.replace("\n", "") for l in f.readlines()]
with open(f"{dirname}/champdup-default-titles.txt", mode="r") as f:
    titles = [l.replace("\n", "") for l in f.readlines()]
with open(f"{dirname}/champdup-didnt-draw.txt", mode="r") as f:
    didnt_draw_data_uri = f.read()

def get_random_title(username: str) -> str:
    t = random.choice(titles).replace("$USERNAME$", username)
    return t

class DrawManager:
    def __init__(self, player_list: list[Player]) -> None:
        self.images: dict[str, Image] = {}
        self.prompt_pool = prompts.copy()
        self.prompts: dict[str, str] = {}
        self.players = player_list
        self.reset()
    
    def add_image(self, username: str, img: Image):
        img.last_changed = datetime.datetime.now().isoformat()
        self.images[username] = img
    
    def get_images(self) -> list[Image]:
        return list(self.images.values())
    
    def process_custom_prompts(self, custom_prompts: list[str], custom_prompts_only: bool) -> None:
        if len(custom_prompts) == 0:
            return
        if custom_prompts_only:
            self.prompt_pool = custom_prompts.copy()
            return
        self.prompt_pool.extend(custom_prompts)
    
    def reset(self):
        self.images = {}
        pcopy = self.prompt_pool.copy()

        for player in self.players:
            if len(pcopy) == 0:
                pcopy = self.prompt_pool.copy()
            prompt = random.choice(pcopy)
            pcopy.remove(prompt)
            self.prompts[player.username] = prompt
            self.images[player.username] = Image(title=get_random_title(player.username), dUri=didnt_draw_data_uri, artists=[player], prompt=prompt)

    def create_counters(self) -> dict[str, Image]:
        plrs = self.players
        offset = random.randint(1, len(plrs) - 1)
        # Get counters by applying an offset to each player
        # (1 <= offset < len(plrs))
        ctrs = [plrs[(plrs.index(plr) + offset) % len(plrs)].username for plr in plrs]
        ctrImgMap = {}
        for plr, ctr in zip(self.players, ctrs):
            ctrImgMap[plr.username] = self.images[ctr]
        return ctrImgMap

class CounterManager:
    def __init__(self, ctr_img_map: dict[str, Image], player_list: list[Player]) -> None:
        self.ctr_img_map: dict[str, Image] = ctr_img_map
        self.ctrs: dict[str, Image] = {}
        self.players = player_list
    
    def set_ctr_img_map(self, map: dict[str, Image]):
        self.ctr_img_map = map
        for player in self.players:
            self.ctrs[player.username] = Image(title=get_random_title(player.username), dUri=didnt_draw_data_uri, artists=[player], prompt=random.choice(prompts))

    def get_matchups(self) -> list[ImageMatchup]:
        '''Returns a shuffled version of the matchups.'''
        matchups = []
        for og, ctr in zip(self.ctr_img_map.values(), self.ctrs.values()):
            matchups.append(ImageMatchup(left=og, right=ctr, leftVotes=set(), rightVotes=set()))
        random.shuffle(matchups)
        return matchups
    
    def set_ctr(self, username: str, img: Image):
        img.last_changed = datetime.datetime.now().isoformat()
        self.ctrs[username] = img
        
    def reset(self):
        self.set_ctr_img_map({})
        self.ctrs = {}

class ReadyManager:
    ready: set[str]

    def __init__(self) -> None:
        self.ready = set()
        self.players: list[Player] = []

    def reset(self, player_list: list[Player]) -> None:
        self.ready = set()
        self.players = player_list
    
    def set_ready(self, p: Player) -> None:
        self.ready.add(p.username)
    
    def all_ready(self) -> bool:
        lr = len(self.ready)
        return all(self.ready) and lr and lr == len(self.players)

class StoreImage(BaseModel):
    image: Image
    image_hash: str

class PlayerImageStore:
    store: dict[str, dict[str, StoreImage]]

    def __init__(self) -> None:
        self.store = {}
    
    def add_plr_img(self, p: Player, img: Image, event_name: str) -> None:
        if p.username not in self.store:
            self.store[p.username] = {}
        self.store[p.username][event_name] = StoreImage(image=img, image_hash=hashlib.sha256(str(img).encode("utf-8")).hexdigest())
    
    def get_store(self) -> dict[str, list[Image]]:
        return self.store
    
    def get_plr_store(self, p: Player, event_blacklist: list[str] = []) -> list[StoreImage]:
        if p.username not in self.store:
            return []
        store = []
        for event_name in self.store[p.username]:
            if event_name in event_blacklist:
                continue
            if self.store[p.username][event_name]:
                store.append(self.store[p.username][event_name])
        return store
    
    def get_plr_image_from_hash(self, username: str, hash: str) -> Image | None:
        if username not in self.store:
            return None
        for event_name in self.store[username]:
            if self.store[username][event_name].image_hash == hash:
                return self.store[username][event_name].image
        return None
    
    def reset(self) -> None:
        '''CAREFUL! Will forget all previously stored player images!'''
        self.store = {}

class Event(BaseModel):
    name: str
    timed: bool
    ends: str | None = None

    def is_active(self) -> bool:
        return datetime.datetime.fromisoformat(self.ends) > datetime.datetime.now()

class LeaderboardImage(BaseModel):
    image: Image
    awards: list[Award]

RUNNING_EVENTS = ["D1", "C1", "V1", "D2", "C2", "V2", "B", "L"]

# Note: technically all of the events have timers attached but vote events
# and the bonus round timers behave differently (vote timer is per image,
# multiple types of bonus rounds with different timers each). The events 
# below can be handled generically though
TIMED_EVENTS = ["D1", "C1", "D2", "C2"]

IVR_TIMEOUT = 10 # seconds

class IVRMode(str, Enum, metaclass=MetaEnum):
    Normal = "normal"
    Grace = "grace"
    Result = "result"

# : Core
class ChampdUp(Game):
    poll: None | Poll

    def __init__(self, b: Broadcast, t: Terminal) -> None:
        super().__init__(b, t)
        self.config = ChampdUpConfig()
        self.poll = None
        self.event_idx = -1
        self.events: list[Event] = []
        for event_name in RUNNING_EVENTS:
            self.events.append(Event(name=event_name, timed=event_name in TIMED_EVENTS))
        self.draw_manager = DrawManager([])
        self.ctr_manager = CounterManager({}, [])
        self.ready_manager = ReadyManager()
        self.matchup_manager = MatchupManager()
        self.player_img_store = PlayerImageStore()
        self.leaderboard: list[Player] = []
        self.leaderboard_images: list[LeaderboardImage] = []
        self.timer = Timer("ChampdUp Timer", t, self.iter_game_events)
        self.ivr_mode : IVRMode | None = None
    
    
    def get_public_field(self, key: str) -> Any:
        return self.config.public[key]
    
    def create_new_timer(self, callback: Callable | Coroutine | None = None) -> None:
        self.timer.kill()
        self.timer = Timer("ChampdUp Timer", self.t, callback)
    
    async def iter_game_events(self) -> None:
        self.debug("iter_game_events called")
        event_before = self.get_current_event()
        self.event_idx += 1
        self.debug(str(self.event_idx))
        if self.event_idx >= len(self.events):
            return
        event = self.get_current_event()
        self.create_new_timer(self.iter_game_events)
        self.debug(f"Processing {event.name}..")
        if event.name == "B" and not self.get_public_field("bonus_round_enabled"):
            return await self.iter_game_events()
        if event.name == "L":
            self.leaderboard = sorted(self.get_player_list(), key=lambda p: p.points, reverse=True)
        if event.name in ("D1", "D2"):
            if event.name ==  "D1":
                self.draw_manager.process_custom_prompts(
                    self.get_public_field("custom_prompts"),
                    self.get_public_field("custom_prompts_only")
                )
            self.draw_manager.players = self.get_player_list()
            self.ready_manager.reset(self.get_player_list())
            self.draw_manager.reset()
        if event.name in ("C1", "C2"):
            self.ctr_manager.reset()
            self.ready_manager.reset(self.get_player_list())
            self.ctr_manager.players = self.get_player_list()
            self.ctr_manager.set_ctr_img_map(self.draw_manager.create_counters())
        if event.name in ("V1", "V2"):
            self.matchup_manager.reset()
            # Setup matchup manager state before broadcasting & handling vote rounds
            for matchup in self.ctr_manager.get_matchups():
                self.matchup_manager.add_matchup(matchup.left, matchup.right)
        if event.timed:
            ends = (datetime.datetime.now() + datetime.timedelta(seconds=self.get_public_field("draw_duration")))
            event.ends = ends.isoformat()
            await self.timer.start(ends)
        for username in self.ws_map:
            await self.send(self.ws_map[username], MessageSchema(type=MessageType.STATE, value=self.get_game_state(username), author=0))
        if event.name in ("V1", "V2"):
            # Begin handling vote rounds
            await self.iter_vote_round()
    
    async def filter_send(self, msg: MessageSchema, whitelist: list[str | int] = [], blacklist: list[str | int] = []):
        '''Filters who to send a message to.
        
        If `whitelist` and `blacklist` are empty lists,
        the message is broadcast to all clients. Otherwise:
        
        If `whitelist` is specified, broadcast only to
        whoever is in the whitelist. Ignore the blacklist.
        
        If `blacklist` is specified (and `whitelist` isn't [racist!!!!1111!]),
        broadcast only to whoever isn't in the blacklist'''

        if not whitelist and not blacklist:
            await self.publish(msg.type, msg.value, msg.author)
        if whitelist:
            for username in whitelist:
                await self.send(self.ws_map[username], msg)
        else:
            for username in self.ws_map:
                if username not in blacklist:
                    await self.send(self.ws_map[username], msg)
    
    async def predicate_send(self, mType: MessageType, predicate: Callable[[str], Any]) -> None:
        '''Whatever `predicate(username)` returns will be sent to the client with the corresponding
        username as the message value.'''
        for username in self.ws_map:
            value = predicate(username)
            await self.send(self.ws_map[username], MessageSchema(type=mType, value=predicate(username), author=0))
    
    async def grace_callback(self, advance_matchup: bool = True) -> None:
        if advance_matchup:
            self.matchup_manager.next_matchup()
        if self.matchup_manager.has_ended():
            self.ivr_mode = None
            self.timer.callback = self.iter_game_events
            return await self.iter_game_events()
        self.matchup_manager.disable_voting()
        ends = datetime.datetime.now() + datetime.timedelta(seconds=IVR_TIMEOUT)
        self.timer.callback = self.iter_vote_round
        await self.filter_send(MessageSchema(type=MessageType.MATCHUP, value={"matchup": self.matchup_manager.get_matchup(), "idx": self.matchup_manager._idx}, author=0))
        await self.timer.start(ends, IVRMode.Normal)
    
    async def iter_vote_round(self, mode: IVRMode = IVRMode.Grace):
        if not self.matchup_manager.matchups:
            self.error("No matchups found at vote round. iter_vote_round will likely error, ensure matchup_manager's matchups have been set before iter_vote_round is called!")
        self.ivr_mode = mode
        if mode == IVRMode.Grace:
            return await self.grace_callback()
        if mode == IVRMode.Result:
            # If the matchup manager has started before we move to the next matchup,
            # then there must have been a previous matchup that just ended. Broadcast
            # matchup winner
            self.matchup_manager.disable_voting()
            matchup = self.matchup_manager.get_matchup()
            llv = len(matchup.leftVotes)
            lrv = len(matchup.rightVotes)

            # Calculate points
            lp, rp = 0, 0
            scalar_w = 1897 * int(self.get_current_event().name[1]) # either V1 or V2, we want points to be doubled during second round
            scalar_l = 949

            # We want at least (roughly) 50% of eligible players to have voted for a bonus
            # to be awarded. Note that an eligible player is any player that isn't one of the
            # picassos behind the image candidates.
            can_bonus = (llv + lrv) > math.floor((len(self.players) - len(matchup.left.artists) - len(matchup.right.artists)) / 2)
            dominated = 0 in (llv, lrv) and (llv, lrv).count(0) == 1
            on_fire = not dominated and (llv > 2 * lrv or lrv > 2 * llv)
            D = can_bonus * dominated * 250 * len(self.players)
            F = can_bonus * on_fire * 125 * max(lrv, lrv)
            B = ((llv + lrv) == 0) * 1
            winner: Image = matchup.left

            def award_points_to_artists(im: Image, inc: int) -> None:
                for artist in im.artists:
                    self.players[artist.username].points += inc

            if llv == lrv:
                # Because right image countered left image,
                # left image is given a slight bonus in points
                lp += scalar_w * llv + 100 + B
                rp += scalar_l * lrv + B
                award_points_to_artists(matchup.left, lp)
                award_points_to_artists(matchup.right, rp)
            elif llv > lrv:
                lp += scalar_w * llv + D + F
                rp += scalar_l * lrv
                award_points_to_artists(matchup.left, lp)
                award_points_to_artists(matchup.right, rp)
            else:
                winner = matchup.right
                lp += scalar_l * llv
                rp += scalar_w * lrv + D + F
                award_points_to_artists(matchup.left, lp)
                award_points_to_artists(matchup.right, rp)
            
            awards: list[Award] = []
            if dominated:
                awards.append(Award(name=AwardName.DOMINATION, bonus=D))
            if on_fire:
                awards.append(Award(name=AwardName.ON_FIRE, bonus=F))
            if (llv + lrv) == 0:
                awards.append(Award(name=AwardName.BRUH, bonus=B))
            
            # Now we evaluate any image that doesn't require the image to be a winner
            # (though it can still be e.g. comeback award) nor any specific amount of
            # players to have voted

            # Note that awards are only shown on the winners, though points are still awarded
            # to losers for awards that can be achieved without winning (e.g. PRIDE award)

            # :: PRIDE award
            # title has the word 'gay' in it
            pride = False
            pride_points = 100
            if matchup.left.title.lower().startswith("gay") or " gay " in matchup.left.title.lower():
                award_points_to_artists(matchup.left, pride_points)
                if winner == matchup.left:
                    pride = True
            if matchup.right.title.lower().startswith("gay") or " gay " in matchup.right.title.lower():
                award_points_to_artists(matchup.right, pride_points)
                if winner == matchup.right:
                    pride = True
            if pride:
                awards.append(Award(name=AwardName.PRIDE, bonus=pride_points))
            
            # :: Comeback award
            # winner started off losing but won in the end
            comeback_points = 300
            if matchup.initial_leader == "left" and winner == matchup.right or \
                matchup.initial_leader == "right" and winner == matchup.left:
                awards.append(Award(name=AwardName.COMEBACK, bonus=comeback_points))
                award_points_to_artists(winner, comeback_points)
            
            # :: Fast award
            # the last change is within the first quarter of the round
            fast_points = 500
            if not winner.last_changed:
                # artists (somehow) won with a blank image)
                awards.append(Award(name=AwardName.FAST, bonus=fast_points))
                award_points_to_artists(winner, fast_points)
            else:
                winner_submitted = datetime.datetime.fromisoformat(winner.last_changed)
                if winner == matchup.left:
                    draw_event_name = self.get_current_event().name.replace("V", "D")
                    event_ends = self.events[0 if draw_event_name == "D1" else 3].ends
                else:
                    ctr_event_name = self.get_current_event().name.replace("V", "C")
                    event_ends = self.events[1 if ctr_event_name == "C1" else 4].ends
                event_ends = datetime.datetime.fromisoformat(event_ends)
                event_starts = event_ends - datetime.timedelta(seconds=self.get_public_field("draw_duration"))
                if winner_submitted < event_ends:
                    t0 = event_starts.timestamp()
                    t1 = winner_submitted.timestamp() - t0 
                    t2 = event_ends.timestamp() - t0
                    if t1/t2 < 1/3:
                        # image was submitted during first third of the event
                        awards.append(Award(name=AwardName.FAST, bonus=fast_points))
                        award_points_to_artists(winner, fast_points)

            # Since images can now be swapped, we don't want two of the same image to show on the end screen.
            # As such we need to check if any leaderboard image previously saved has the same title and
            # dUri as our current image. If so, do not add this image as this image was swapped in (still
            # award points though.)
            image_was_swapped = False
            for leaderboard_image in self.leaderboard_images:
                if leaderboard_image.image.title == winner.title and leaderboard_image.image.dUri == winner.dUri:
                    image_was_swapped = True
                    break
            if not image_was_swapped:
                self.leaderboard_images.append(LeaderboardImage(image=winner, awards=awards))
            ends = (datetime.datetime.now() + datetime.timedelta(seconds=IVR_TIMEOUT))
            await self.filter_send(MessageSchema(
                type=MessageType.MATCHUP_RESULT,
                value={
                    "winner": winner,
                    "points": lp if llv >= lrv else rp,
                    "awards": awards,
                    "ends": ends.isoformat(),
                },
                author=0,
            ))
            return await self.timer.start(ends, IVRMode.Grace)

        self.matchup_manager.enable_voting()
        ends = (datetime.datetime.now() + datetime.timedelta(seconds=self.get_public_field("vote_duration")))
        matchup = self.matchup_manager.get_matchup()
        def predicate(username: str) -> bool:
            default = {"matchup": self.matchup_manager.get_matchup(), "idx": self.matchup_manager._idx, "ends": ends}
            if self.get_current_event().name != "V2":
                return default
            for i, artist_pool in enumerate((matchup.left.artists, matchup.right.artists)):
                for artist in artist_pool:
                    if username == artist.username:
                        is_left = i == 0
                        blacklist = ["D2", "C2"]
                        default["swap_candidates"] = self.player_img_store.get_plr_store(self.get_player(username).data, blacklist)
            return default
        
        await self.predicate_send(
            MessageType.MATCHUP,
            predicate,
        )
        await self.timer.start(ends, IVRMode.Result)
    
    def get_current_event(self) -> Event:
        return self.events[self.event_idx]
    
    def get_game_state(self, username: str | int) -> dict[str, Any]:
        event_data = {}
        if self.get_current_event().name in ("D1", "D2"):
            if username != 0:
                event_data = {
                    "prompt": self.draw_manager.prompts[username],
                    "players_ready": self.ready_manager.ready,
                }
        if self.get_current_event().name in ("C1", "C2"):
            if username != 0:
                event_data = {
                    "counter": self.ctr_manager.ctr_img_map[username],
                    "players_ready": self.ready_manager.ready,
                }
        if self.get_current_event().name in ("V1", "V2"):
            if self.matchup_manager.has_started():
                event_data = {
                    "matchup": self.matchup_manager.get_matchup(),
                }
        if self.get_current_event().name == "L":
            event_data = {
                "leaderboard": self.leaderboard,
                "leaderboard_images": self.leaderboard_images,
            }
        return {
            "host_connected": self.host_connected,
            "status": self.status,
            "players": self.get_player_list(),
            "event": self.get_current_event(),
            "event_data": event_data,
            "via": username,
        }
    
    def get_max_players(self) -> int:
        return self.get_public_field("max_players")
    
    def load_public_config(self, pub: PublicConfig) -> list[tuple[str, str]]:
        errors: list[tuple[str, str]] = []
        for k, v in pub.items():
            if k not in DEFAULT_PUBLIC_ATTRS:
                errors.append((k, "Unrecognized key"))
                continue
            if k == "max_players":
                try:
                    v = int(v)
                except ValueError:
                    errors.append((k, "Max players must be a number"))
                    continue
                if v < 3:
                    errors.append((k, "Max players must be at least 3 (a minimum of 3 players are required to play)."))
                    continue
            if k == "poll_duration":
                try:
                    v = int(v)
                except ValueError:
                    errors.append((k, "Poll duration must be a whole number > 5"))
                    continue
                if v < 5:
                    errors.append((k, "Poll duration must be a whole number > 5"))
                    continue
            if k in ("bonus_round_enabled", "polls_enabled", "host_only_polls"):
                try:
                    v = bool(v)
                except ValueError:
                    errors.append((k, "Value must be true/false"))
                    continue
            if k in ("draw_duration", "vote_duration"):
                try:
                    v = int(v)
                except ValueError:
                    errors.append((k, "Value must be an integer"))
                    continue
                if v < 10:
                    errors.append((k, "Value must be at least 10 (seconds)"))
                    continue
            if k == "force_next_event_after_all_images_received":
                try:
                    v = bool(v)
                except Exception:
                    errors.append((k, "Value must be a boolean value"))
                    continue
            if k == "custom_prompts":
                try:
                    v = str(v)
                    v = v.split(";")
                except Exception:
                    errors.append((k, "Value must be a string and each prompt must be separated by a semi-colon (;)"))
                    continue
            if k == "custom_prompts_only":
                try:
                    v = bool(v)
                except Exception:
                    errors.append((k, "Value must be a boolean value"))
                    continue
            self.config.public[k] = v
        self.max_players = self.get_public_field("max_players")
        return errors
    
    def validate_chat_msg(self, msg: MessageSchema) -> bool:
        '''Assumes `msg.type` == `MessageType.CHAT`.'''
        return type(msg.value) == str
    
    def validate_poll_msg(self, msg: MessageSchema) -> bool:
        if self.poll and not self.poll.is_active():
            self.poll = None
        if self.poll:
            return False
        if msg.author != 0 and self.get_public_field("host_only_polls"):
            return False
        if type(msg.value) != str or not self.get_public_field("polls_enabled"):
            return False
        text: str = msg.value
        if text.startswith("/poll "):
            text = text.removeprefix("/poll ").strip()
            return bool(text)
        return False
    
    def validate_sponsor_msg(self, msg: MessageSchema) -> bool:
        if self.poll and self.poll.is_active():
            return False
        if type(msg.value) != str:
            return False
        text: str = msg.value
        return text.strip() == "/sponsor"
    
    def prepare_sponsor_msg(self) -> ProcessedMessage:
        pm = ProcessedMessage()
        pm.add_broadcast(MessageType.SPONSOR, None, 0)
        return pm
    
    def prepare_poll_broadcast(self, text: str, author: int | str) -> ProcessedMessage:
        pm = ProcessedMessage()
        self.poll = Poll(
            ends=(datetime.datetime.now() + datetime.timedelta(seconds=self.get_public_field("poll_duration"))).isoformat(),
            prompt=text.removeprefix("/poll "),
            yes=set(),
            no=set(),
        )
        if author == 0:
            pm.add_broadcast(MessageType.POLL, self.poll, author)
        else:
            pm.add_broadcast(MessageType.POLL, self.poll, self.get_player(author).data)
        return pm
    
    def handle_poll_vote(self, vote: Literal["Yes"] | Literal["No"], author: str | int) -> ProcessedMessage:
        pm = ProcessedMessage()
        if not self.poll or vote not in ("yes", "no") or not self.poll.is_active():
            return pm
        author_name = author
        if type(author) == int:
            author_name = "Host"
        for v in (self.poll.yes, self.poll.no):
            if author_name in v:
                v.remove(author_name)
        if vote == "yes":
            self.poll.yes.add(author_name)
        else:
            self.poll.no.add(author_name)
        if author == 0:
            pm.add_broadcast(MessageType.POLL_VOTE, self.poll, author)
        else:
            pm.add_broadcast(MessageType.POLL_VOTE, self.poll, self.get_player(author).data)
        return pm
    
    async def handle_private_message(self, sender: str | int, command: str):
        if not self.get_public_field("enable_private_messages"):
            return False
        if type(command) != str or not command.startswith("/pm "):
            return False
        match = ""
        matched_partition = ""
        text = command.removeprefix("/pm ")
        # Find best match, if any
        player_names = list(self.players.keys())
        partition = ""
        words = text.split(" ")
        _sender = str(sender)
        for word in words:
            partition = " ".join([partition, word]).strip()
            for v in sorted(player_names, key=lambda x: len(x)):
                if v.lower() == _sender.lower():
                    continue
                if v.lower() == partition.lower():
                    match = v
                    matched_partition = partition
                    break
            if match or len(partition) > MAX_USERNAME_LENGTH:
                break
        #match = list(self.players.keys())[player_lower.index(partition.lower())]
        if match and sender != match:
            msg = text[len(matched_partition):].strip()
            #self.debug(f"HERE NOW, {match}, {matched_partition}, {msg}")
            if not msg:
                return
            author = sender
            if author != 0:
                author = self.get_player(author).data
            if not sender in self.ws_map or not match in self.ws_map:
                return
            await self.send(self.ws_map[sender], MessageSchema(type=MessageType.PM, value={"msg": msg, "from": "Host" if sender == 0 else sender, "to": match}, author=author))
            await self.send(self.ws_map[match], MessageSchema(type=MessageType.PM, value={"msg": msg, "from": "Host" if sender == 0 else sender, "to": match}, author=author))
            return True
        return False
    
    async def process_host_message(self, ws: WebSocket, msg: MessageSchema, username: int) -> ProcessedMessage:
        pm = ProcessedMessage()
        if msg.type == MessageType.STATUS:
            if not msg.value in GameStatus or len(self.players) < 3:
                pm.add_msg(MessageType.NOTIFY, {"type": NotifyType.FAIL, "msg": "You need at least 3 players to start!"}, 0)
                return pm
            self.status = msg.value
            if self.status == GameStatus.RUNNING:
                await self.iter_game_events()
            else:
                self.timer.kill()
            if self.status != GameStatus.RUNNING:
                for name, _ws in self.ws_map.items():
                    await self.send(_ws, MessageSchema(type=MessageType.STATE, value=self.get_game_state(name), author=0))
            return pm
        if msg.type == MessageType.PM:
            await self.handle_private_message(username, msg.value)
            return pm
        if msg.type == MessageType.CHAT:
            if self.validate_chat_msg(msg):
                if msg.value.strip() == "/kill":
                    await self.kill()
                    return pm
                if self.validate_poll_msg(msg):
                    return self.prepare_poll_broadcast(msg.value, username)
                pm.add_broadcast(msg.type, msg.value, 0)
        if msg.type == MessageType.POLL_VOTE:
            if msg.value.lower() in ("yes", "no"):
                return self.handle_poll_vote(msg.value.lower(), username)
        if self.get_current_event().name in ("V1", "V2"):
            if msg.type == MessageType.MATCHUP_START:
                # check if we can skip
                if all(
                    self.matchup_manager.has_started(),
                    not self.matchup_manager.has_ended(),
                    self.ivr_mode and self.ivr_mode != IVRMode.Normal,

                ):
                    if self.timer.callback == self.iter_vote_round:
                        self.timer.kill()
                    if self.ivr_mode == IVRMode.Grace:
                        await self.grace_callback(advance_matchup=False)
                    else:
                        await self.iter_vote_round(IVRMode.Result)
        return pm
    
    async def process_plyr_message(self, ws: WebSocket, msg: MessageSchema, username: str) -> ProcessedMessage:
        pm = ProcessedMessage()
        if msg.type == MessageType.PM:
            await self.handle_private_message(username, msg.value)
            return pm
        if msg.type == MessageType.CHAT:
            if self.validate_chat_msg(msg):
                if self.validate_sponsor_msg(msg):
                    return self.prepare_sponsor_msg()
                if self.validate_poll_msg(msg):
                    return self.prepare_poll_broadcast(msg.value, username)
                text: str = msg.value
                if not text.startswith("/"):
                    pm.add_broadcast(msg.type, msg.value, self.get_player(username).data)
        if msg.type == MessageType.POLL_VOTE:
            if msg.value.lower() in ("yes", "no"):
                return self.handle_poll_vote(msg.value.lower(), username)
        
        MAX_TITLE_LENGTH = 64
        if self.get_current_event().name in ("D1", "D2"):
            if msg.type == MessageType.IMAGE:
                # User submitted draw image
                if type(msg.value) == dict and "dUri" in msg.value and type(msg.value["dUri"]) == str and "title" in msg.value and type(msg.value["title"]) == str and len(msg.value["title"]) <= MAX_TITLE_LENGTH:
                    title = msg.value["title"]
                    if not title:
                        title = get_random_title(username)
                    im = Image(title=title, dUri=msg.value["dUri"], artists=[self.get_player(username).data], prompt=self.draw_manager.prompts[username])
                    self.draw_manager.add_image(username, Image(title=title, dUri=msg.value["dUri"], artists=[self.get_player(username).data], prompt=self.draw_manager.prompts[username]))
                    self.player_img_store.add_plr_img(self.get_player(username).data, im, self.get_current_event().name)
                    self.ready_manager.set_ready(self.get_player(username).data)
                    pm.add_msg(MessageType.NOTIFY, {"type": NotifyType.SUCCESS, "msg": "Your image submitted successfully!"}, 0)
                    if self.ready_manager.all_ready() and self.get_public_field("force_next_event_after_all_images_received"):
                        await self.iter_game_events()
                        self.debug("PUNGENT")
                        return pm
                    pm.add_broadcast(MessageType.IMAGE_SUBMITS, self.ready_manager.ready, 0)
        if self.get_current_event().name in ("C1", "C2"):
            if msg.type == MessageType.IMAGE:
                if type(msg.value) == dict and "dUri" in msg.value and type(msg.value["dUri"]) == str and "title" in msg.value and type(msg.value["title"]) == str and len(msg.value["title"]) <= MAX_TITLE_LENGTH:
                    title = msg.value["title"]
                    if not title:
                        title = get_random_title(username)
                    im = Image(title=title, dUri=msg.value["dUri"], artists=[self.get_player(username).data], prompt=self.draw_manager.prompts[username])
                    self.ctr_manager.set_ctr(username, im)
                    self.player_img_store.add_plr_img(self.get_player(username).data, im, self.get_current_event().name)
                    self.ready_manager.set_ready(self.get_player(username).data)
                    pm.add_msg(MessageType.NOTIFY, {"type": NotifyType.SUCCESS, "msg": "Your image submitted successfully!"}, 0)
                    if self.ready_manager.all_ready() and self.get_public_field("force_next_event_after_all_images_received"):
                        await self.iter_game_events()
                        self.debug("PUNGENT")
                        return pm
                    pm.add_broadcast(MessageType.IMAGE_SUBMITS, self.ready_manager.ready, 0)
        if self.get_current_event().name in ("V1", "V2"):
            if msg.type == MessageType.MATCHUP_VOTE:
                if not self.matchup_manager.has_started() or not self.matchup_manager.voting_enabled:
                    return pm
                m = self.matchup_manager.get_matchup()
                artists = [x.username for x in m.left.artists] + [x.username for x in m.right.artists]
                if username in artists:
                    return pm
                if msg.value in ("left", "right"):
                    self.matchup_manager.get_matchup().add_vote(username, msg.value)
                    pm.add_broadcast(MessageType.MATCHUP_VOTE, {
                        "left": self.matchup_manager.get_matchup().leftVotes,
                        "right": self.matchup_manager.get_matchup().rightVotes,
                    }, 0)
            if msg.type == MessageType.IMAGE_SWAP and self.get_current_event().name == "V2":
                # We don't want the 2P1B vote round to be included in this (when it's implemented,
                # hence the double-check atm) nor do we want swaps during the first round.
                if not self.matchup_manager.has_started() or self.ivr_mode in (None, IVRMode.Result):
                    return pm
                # Figure out if they're in the matchup
                
                matchup = self.matchup_manager.get_matchup()
                p = self.get_player(username).data
                is_left = p in matchup.left.artists
                is_right = p in matchup.right.artists
                
                if not is_left and not is_right:
                    return pm
                if type(msg.value) != str:
                    return pm
                swap_img = self.player_img_store.get_plr_image_from_hash(username, msg.value)
                if not swap_img:
                    return pm
                if swap_img.title in (matchup.left.title, matchup.right.title) and \
                    swap_img.dUri in (matchup.left.dUri, matchup.right.dUri):
                    pm.add_msg(MessageType.NOTIFY, {"type": NotifyType.FAIL, "msg": "You cannot swap in the same image!"}, 0)
                    return pm
                if is_left:
                    matchup.left = swap_img
                else:
                    matchup.right = swap_img
                await self.filter_send(MessageSchema(
                    type=MessageType.IMAGE_SWAP,
                    value={"target": "left" if is_left else "right", "matchup": matchup},
                    author=0
                ))
        return pm

# : Clean
import atexit

def clean_task_threads():
    print(f"Cleaning {len(task_threads)} threads..")
    for t in task_threads:
        t: threading.Thread = t
        t.join()

atexit.register(clean_task_threads)