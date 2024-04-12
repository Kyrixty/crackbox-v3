import os

from config import Config
from globals import ROOT_PATH, CONFIG_PATH
from base64 import b64encode
from terminal import Terminal, TerminalOpts

SECRET_SIZE = 64
t = Terminal(TerminalOpts())


class AppSetup:
    '''Used to setup the app instance.
    Called in `main` via `AppSetup.try_setup()`.
    Do not attempt to setup outside of main.'''

    def __init__(self) -> None:
        pass

    def _setup(self) -> None:
        if not os.path.isfile(CONFIG_PATH):
            t.log("Saving config..")
            Config().save_config(CONFIG_PATH)
        else:
            t.info("Found config.json, delete this file if you wish to return to default values.")
        t.log("Finished")
        t.log("Creating environment file..")
        with open(f"{ROOT_PATH}/.env", mode="w") as f:
            f.write(f"SECRET_KEY=\"{b64encode(os.urandom(SECRET_SIZE)).decode('utf-8')}\"")
        t.log("Finished")


    def try_setup(self) -> None:
        t.log("Beginning setup..")
        try:
            self._setup()
            t.log("Setup finished.")
        except Exception as e:
            t.error(f"Fatal error occurred during setup: {e}")
    
if __name__ == "__main__":
    setup = AppSetup()
    setup.try_setup()