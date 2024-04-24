import { Player } from "@lib/player";
import { ReadyState } from "react-use-websocket";
import { create } from "zustand";

export type JsonMessage<T> = {
  type: T;
  value: any;
};

export type RJsonMessage<T> = {
  type: T;
  value: any;
  author: Player | 0;
  ping: number | null;
}

export const READYSTATE_MAP = {
  [ReadyState.CONNECTING]: "Connecting",
  [ReadyState.OPEN]: "Open",
  [ReadyState.CLOSING]: "Closing",
  [ReadyState.CLOSED]: "Closed",
  [ReadyState.UNINSTANTIATED]: "Uninstantiated",
};

export interface MessageContext<T> {
  lastJsonMessage: RJsonMessage<T>;
  readyState: ReadyState;
  ping: number | null;
  setLastJsonMessage: (m: RJsonMessage<T>) => void;
  sendJsonMessage: (m: JsonMessage<T>) => void;
  setSendJsonMessage: (sjm: (m: JsonMessage<T>) => void) => void;
  setReadyState: (s: ReadyState) => void;
  setPing: (p: number | null) => void;
}

const err = (e: string) => {
  console.error(e, "has not been set! Check game root for details!")
}

const useMessageContextImplementation = create<MessageContext<any>>((set) => ({
  lastJsonMessage: {type: null, value: null, author: 0, ping: null},
  readyState: ReadyState.CLOSED,
  ping: null,
  setLastJsonMessage: (m: any) => set(() => ({lastJsonMessage: m})),
  sendJsonMessage: (m: any) => err("sendJsonMessage"),
  setSendJsonMessage: (sjm: (m: any) => void) => set(() => ({sendJsonMessage: sjm})),
  setReadyState: (s: ReadyState) => set(() => ({readyState: s})),
  setPing: (p: number | null) => set(() => ({ping: p})),
}));

export const useMessenger = useMessageContextImplementation as {
  <T>(): MessageContext<T>;
  <T, U>(selector: (s: JsonMessage<T>) => U): U;
};
