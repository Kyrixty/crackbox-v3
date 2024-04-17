import { create } from "zustand";

export type PollData = {
  ends: string;
  prompt: string;
  // Backend guarantees that yes and no are distinct (no usernames in yes appear in no, and vice versa)
  yes: string[];
  no: string[];
}

interface PollPrefs {
  showPolls: boolean;

  setShowPolls: (v: boolean) => void;
}

export const usePollPrefs = create<PollPrefs>()((set) => ({
  showPolls: true,

  setShowPolls: (v: boolean) => set(() => ({showPolls: v}))
}))