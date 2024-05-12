import { Player } from "@lib/player";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export enum DefaultMessageType {
  HOST_CONNECT = "HOST_CONNECT",
  HOST_DISCONNECT = "HOST_DISCONNECT",
  CONNECT = "CONNECT",
  DISCONNECT = "DISCONNECT",
  STATE = "STATE",
  STATUS = "STATUS",
  PING = "PING",
}

export enum GameStatus {
  WAITING = "WAITING",
  RUNNING = "RUNNING",
  STOPPED = "STOPPED",
}

export type GameContext = {
  gameId: string;
  status: GameStatus;
  players: Player[];
  lastPlayer: Player | null;
  hostConnected: boolean;

  setGameId: (id: string) => void;
  setStatus: (s: GameStatus) => void;
  setPlayers: (p: Player[]) => void;
  setLastPlayer: (p: Player) => void;
  setHostConnected: (v: boolean) => void;
  reset: () => void;
  landingReset: () => void;
};

const tryClearSessionStorage = (cb: () => any) => {
  // Since players now contain Data URIs, we may run out of session storage.
  // In this case, clear it and alert the user.
  try {
    cb();
  } catch (e) {
    alert("Your session storage is full. Clearing it now, please try rejoining/reconnecting if problems occur.");
  }
}

export const useGameContext = create<GameContext>()(
  persist(
    (set, get) => ({
      gameId: "",
      players: [],
      lastPlayer: null,
      status: GameStatus.WAITING,
      hostConnected: true, // ($) we assume the host is connected until we receive the game state soon after connection start

      setGameId: (id: string) => set(() => ({ gameId: id })),
      setStatus: (s: GameStatus) => set(() => ({ status: s })),
      setPlayers: (p: Player[]) => tryClearSessionStorage(() => set(() => ({ players: p }))),
      setLastPlayer: (p: Player) => tryClearSessionStorage(() => set(() => ({ lastPlayer: p }))),
      setHostConnected: (v: boolean) => set(() => ({ hostConnected: v })),
      reset: () =>
        set(() => ({
          gameId: "",
          players: [],
          lastPlayer: null,
          status: GameStatus.WAITING,
          hostConnected: true, //@$
        })),
      landingReset: () =>
        set(() => ({
          players: [],
          lastPlayer: null,
          status: GameStatus.WAITING,
          hostConnected: true,
        })),
    }),
    { name: "game-context", storage: createJSONStorage(() => sessionStorage) }
  )
);

export type GameStyleContext = {
  bg: string;
  className: string;
  setBg: (s: string) => void;
  setClassName: (s: string) => void;
};

export const useGameStyleContext = create<GameStyleContext>()((set) => ({
  bg: "",
  className: "",
  setBg: (s: string) => set(() => ({bg: s})),
  setClassName: (s: string) => set(() => ({ className: s })),
}));
