import os

def file_exists(fp: str) -> bool:
    '''Wrapper around `os.path.isfile`.'''
    return os.path.isfile(fp)

def dir_exists(dp: str) -> bool:
    '''Wrapper around `os.path.isdir`.'''
    return os.path.isdir(dp)