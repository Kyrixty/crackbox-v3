#### NOTE: This file cannot import any project files
import os

DEBUG = True

###############
#### PATHS ####
###############
ROOT_PATH = os.path.dirname(__file__)
ENV_PATH = os.path.join(ROOT_PATH, ".env")
CONFIG_PATH = os.path.join(ROOT_PATH, "config.json")
CONFIG_TEST_PATH = os.path.join(ROOT_PATH, "config.test.json") # Config for test.py

MAX_USERNAME_LENGTH = 18

#Misc
SIMULATE_LAG_MAX = 120
SIMULATE_LAG_MIN = 10

if __name__ == "__main__":
    print(f"ROOT_PATH: {ROOT_PATH}")
    print(f"CONFIG_PATH: {CONFIG_PATH}")