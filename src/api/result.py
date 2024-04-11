from typing import TypeVar, Generic
from pydantic import BaseModel

T = TypeVar("T")

class Result(BaseModel, Generic[T]):
    """A `Result` tells a caller whether or not
    a function/method/coroutine completed successfully.
    If it did, the `Result` also includes `data` as an
    attribute which can be of any type and defaults
    to `None`. Note that if a result is unsuccessful,
    `data` will be `None`."""
    data: T = None
    success: bool = False
    reason: str = "No detail provided."

    def Ok(self, data: T) -> None:
        '''Sets the result's success to `True`,
        also sets `data`.'''
        self.success = True
        self.data = data
        self.reason = "No detail provided."
    
    def Fail(self, reason: str = "No reason provided.") -> None:
        '''Fails the result, setting its success state
        to `False`.'''
        self.success = False
        self.data = None
        self.reason = reason
    
    class Config:
        arbitrary_types_allowed=True