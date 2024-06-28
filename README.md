# Crackbox V3
<p align="center">
  <img src="https://github.com/Kyrixty/crackbox-v3/blob/main/src/web/public/imgs/crackbox-logo-name.png?raw=true" />
</p>

<p style="text-align: center;">
  This is the third (and hopefully last) iteration of Crackbox, a custom-made party game inspired by the Jackbox Party Pack series.
</p>

## Setup

### API
Before doing anything, if you see an `@DEBUG` in this it means that an option/feature/whatever is only active if `DEBUG` is set to `True` in `src/api/globals.py`.
To setup the API, do the following (python=3.10):

First, `cd` into the correct directory:
```bash
cd src/api
```

#### First time setup
If this is your first time setting up and running the backend instance, you should run the following scripts first:

```bash
pip install -r requirements.txt
python setup.py
```
This will create a `config.json` under the current directory. You can turn on `simulate_lag@DEBUG` if in development.

Note: the `DEBUG` flag in `src/api/globals.py` should be set to `False` in production. Please make sure you set it to `False`
before deploying (or create a production pipeline to automatically do this).

#### Running the API
```bash
uvicorn main:app
```

Production deployments may look different and you will want to consult their docs to see what the proper setup is for them.
A basic Nginx + Gunicorn setup *seems* to be fine, though.

### Web
First, `cd` into the correct directory:
```bash
cd src/web
```

#### First time setup
Install dependencies:
```bash
yarn
```

#### Running the frontend
Pretty simple in development, just use:
```bash
npx vite
```
Note that you will need to build the frontend for production. Lookup a tutorial if needed.


#### Adding your own Custom Games
Consult the Game architecture for both the frontend and backend logic (see context/ws.ts & api/game.py for abstract implementation guidelines)

In general, a basic game consists of the following:

```python
from game import Game, ProcessedMessage, MessageSchema, GameStatus
from fastapi import WebSocket
from terminal import Terminal
from broadcaster import Broadcast

# Note: these two imports are not technically required but will make message processing simpler
from enum import Enum
from metaenum import MetaEnum

class CustomMessageTypes(str, Enum, metaclass=MetaEnum):
    CHAT = "CHAT"
    START = "START"
    STATUS = "STATUS"

class MyCustomGame(Game):
    def __init__(self, b: Broadcast, t: Terminal) -> None:
        super().__init__(self, b, t)
        # Whatever initialization setup you need can go here
        self.important_attribute = 5
    
    # Note: You can implement your own game logic in practically any way you want, the engine doesn't care. The only things
    # that the engine requires is that you provide the methods below:

    def get_game_state(self, username: str | int) -> dict[str, Any]:
        # There are 3 required fields (you can add any extra fields you like):
        return {
            "host_connected": self.host_connected,
            "status": self.status,
            "players": self.get_player_list(),
        }

    # Note: it is possible in both process_host_message and process_plyr_message to not add any messages or broadcasts to be sent.
    # In other words, you can write your own broadcast and private messaging logic if needed, however do make sure both of 
    # these methods return a `ProcessedMessage` (even if you don't plan on using it)
    async def process_host_message(self, ws: WebSocket, msg: MessageSchema, username: int) -> ProcessedMessage:
        pm = ProcessedMessage()
        if msg.type == CustomMessageTypes.START and self.status == GameStatus.WAITING:
            self.status = GameStatus.RUNNING
            pm.add_broadcast(CustomMessageTypes.STATUS, None, 0)
        return pm
    
    async def process_plyr_message(self, ws: WebSocket, msg: MessageSchema, username: str) -> ProcessedMessage:
        pm = ProcessedMessage()
        if msg.type == CustomMessageTypes.CHAT:
            # Validate message value
            if type(msg.value) == str and len(msg.value.strip()) > 0:
                # Imagine we don't want to broadcast this chat message to the author of it
                # (since the client would double-render the message in this imaginary
                # scenario), thus we only send it to all clients except the sender.
                for _username in self.ws_map:
                    if _username == username:
                        continue
                    ws = self.ws_map[_username]
                    await self.send(ws, MessageSchema(
                        type=MessageType.CHAT,
                        value=msg.value,
                        author=self.get_player(username).data
                    ))
                # This is an example of a custom-made broadcast logic, where we only want to
                # send it to a select group of clients. The ProcessedMessage cannot do this
                # so it makes sense to make our own. This is what the note above was talking
                # about. You can implement this logic in practically anyway that you want.
        return pm
```
Default games (such as ChampdUp) are tested on VERY slow connections (ping of ~1000-2000ms) and *officially* support
up to 10 players unless otherwise noted, however users can have more (there just aren't any guarantees on performance/stability/functionality).

You should also be mindful of the data you're broadcasting. This precaution isn't just for sensitive data but also the size of data. If you plan on
having mobile support be wary that mobile data connections are generally around 12Mbps (~1.5 MBps), so videos being broadcast may not be ideal and you
may have to implement a streaming solution. The default games have mobile support but only for players, the host is generally accepted to be on a desktop
(since these are party games, everybody is meant to be watching the host's screen/stream). Again, the engine doesn't require that you do this, you can implement
your games in pretty much anyway you want.

Some additional things:
- It's been said before, but you are encouraged to implement your game logic in your own way. The engine was designed to be as permissive as possible while still
having some middleground so it can handle connections in the background for you. There are very few restrictions on your custom game with the above implementation
satisfying all of them. You can import whatever packages you want, have whatever data structure you want, pretty much anything. If you need some examples
of games being implemented, check out the default games as they are open source (and not too complicated).

- Host & Players can only create/join a game if it's status is WAITING and can only reconnect if its status is RUNNING. Neither join nor reconnect are allowed
if it is STOPPED.

- Public/private configurations are not required. Do note that the landing page will only render public config options if
you use the implementation provided.

:)