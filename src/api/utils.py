import os
import string
import random

ALL_CHARS = string.digits + string.ascii_letters + string.punctuation + " "
ALL_CHARS_NO_SPACE = ALL_CHARS[:len(ALL_CHARS) - 1]

def file_exists(fp: str) -> bool:
    '''Wrapper around `os.path.isfile`.'''
    return os.path.isfile(fp)

def dir_exists(dp: str) -> bool:
    '''Wrapper around `os.path.isdir`.'''
    return os.path.isdir(dp)

def gen_rand_str(l: int, chars: str = ALL_CHARS, join_str: str = "") -> str:
    if l <= 0:
        raise ValueError(f"gen_rand_str::Bad argument for parameter l > 0: l={l}")
    return join_str.join([random.choice(chars) for _ in range(l)])

def gen_rand_hex_color() -> str:
    chars = string.digits + string.ascii_uppercase
    return "#"+"".join(gen_rand_str(6, chars))