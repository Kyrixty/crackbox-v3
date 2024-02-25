from typing import TypeVar, Generic
from pydantic import BaseModel

T = TypeVar("T")

class Result(BaseModel, Generic[T]):
    """A `Result` tells a caller whether or not
    a function/method/coroutine completed successfully.
    If it did, the `Result` also includes `data` as an
    attribute which can be of any type and defaults
    to `None`."""
    data: T | None = None
    success: bool = False

    def Ok(self, data: T) -> None:
        '''Sets the result's success to `True`,
        also sets `data`.'''
        self.success = True
        self.data = data
    
    def Fail(self) -> None:
        '''Fails the result, setting its success state
        to `False`.'''
        self.success = False
        self.data = None
    
    class Config:
        arbitrary_types_allowed=True