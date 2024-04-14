import { Player } from "@lib/player";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type GameContext = {
  gameId: string;
  players: Player[];

  setGameId: (id: string) => void;
  setPlayers: (p: Player[]) => void;
};

export const useGameContext = create<GameContext>()(
  persist(
    (set, get) => ({
      gameId: "",
      players: [],

      setGameId: (id: string) => set(() => ({ gameId: id })),
      setPlayers: (p: Player[]) => set(() => ({ players: p })),
    }),
    { name: "game-context", storage: createJSONStorage(() => sessionStorage) }
  )
);
