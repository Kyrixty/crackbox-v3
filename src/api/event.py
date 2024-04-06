from pydantic import BaseModel
from typing import TypeVar, Generic, List, Any

T = TypeVar("T")

class EventMessage(BaseModel, Generic[T]):
    author: str
    label: str
    data: T

class Event(Generic[T]):
    data: T

    def __init__(self, name: str) -> None:
        '''Do not override unless you know what you're doing.'''
        self.name = str
        self.running = False
    
    def start(self, data_collected: dict[str, "Event"]) -> None:
        '''Event startup, called before any messages can be received. Should set `Event.data` to a default value here, and store any needed data from `data_collected`.'''
        raise NotImplementedError("Override this method in your custom event.")
    
    def on_player_message(self, data: EventMessage[T]):
        '''Called when a player message is received that is not a higher-level message, such as chat, join, or leave.'''
        raise NotImplementedError("Override this method in your custom event.")
    
    def stop(self) -> None:
        '''When `stop` is called, the event should store any data collected in the EventStore for future events (if needed).'''
        raise NotImplementedError("Override this method in your custom event.")

class Store(Generic[T]):
    def __init__(self) -> None:
        self.store: dict[str, T] = {}
    
    def get_store(self) -> dict[str, T]:
        return self.store
    
    def set_store(self, name: str, data: dict[str, T]) -> None:
        self.store = data
    
    def get_store_var(self, name: str) -> T:
        return self.stores[name]
    
    def set_store_var(self, name: str, data: T) -> None:
        self.stores[name] = data