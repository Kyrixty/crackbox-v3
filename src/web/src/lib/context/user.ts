import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type UserContext = {
  username: string;
  token: string;
  ticket: string;
  isHost: boolean;
  avatarDataUrl: string;

  setUsername: (u: string) => void;
  setToken: (t: string) => void;
  setTicket: (t: string) => void;
  setIsHost: (v: boolean) => void;
  setAvatarDataUrl: (u: string) => void;
};

export const useUserContext = create<UserContext>()(
  persist(
    (set) => ({
      username: "",
      token: "",
      ticket: "",
      isHost: false,
      avatarDataUrl: "",

      setUsername: (u: string) => set(() => ({ username: u })),
      setToken: (t: string) => set(() => ({ token: t })),
      setTicket: (t: string) => set(() => ({ ticket: t })),
      setIsHost: (v: boolean) => set(() => ({ isHost: v })),
      setAvatarDataUrl: (dUrl: string) => set(() => ({ avatarDataUrl: dUrl })),
    }),
    { name: "user-context", storage: createJSONStorage(() => sessionStorage) }
  )
);
