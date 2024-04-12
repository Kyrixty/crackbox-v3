#### NOTE: This file cannot import any project files
import os

DEBUG = False

###############
#### PATHS ####
###############
ROOT_PATH = os.path.dirname(__file__)
ENV_PATH = os.path.join(ROOT_PATH, ".env")
CONFIG_PATH = os.path.join(ROOT_PATH, "config.json")
CONFIG_TEST_PATH = os.path.join(ROOT_PATH, "config.test.json") # Config for test.py

if __name__ == "__main__":
    print(f"ROOT_PATH: {ROOT_PATH}")
    print(f"CONFIG_PATH: {CONFIG_PATH}")