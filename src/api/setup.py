from config import Config
from globals import CONFIG_PATH

#### NOTE: Only main.py may import this file.

class AppSetup:
    '''Used to setup the app instance.
    Called in `main` via `AppSetup.try_setup()`.
    Do not attempt to setup outside of main.'''

    def __init__(self) -> None:
        pass

    def try_setup(self) -> None:
        Config().save_config(CONFIG_PATH)
    
