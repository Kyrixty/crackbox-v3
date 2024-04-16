import { Player } from "@lib/player";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type GameContext = {
  gameId: string;
  players: Player[];
  lastPlayer: Player | null;

  setGameId: (id: string) => void;
  setPlayers: (p: Player[]) => void;
  setLastPlayer: (p: Player) => void;
  reset: () => void;
};

export const useGameContext = create<GameContext>()(
  persist(
    (set, get) => ({
      gameId: "",
      players: [],
      lastPlayer: null,

      setGameId: (id: string) => set(() => ({ gameId: id })),
      setPlayers: (p: Player[]) => set(() => ({ players: p })),
      setLastPlayer: (p: Player) => set(() => ({ lastPlayer: p })),
      reset: () => set(() => ({gameId: "", players: [], lastPlayer: null})),
    }),
    { name: "game-context", storage: createJSONStorage(() => sessionStorage) }
  )
);
