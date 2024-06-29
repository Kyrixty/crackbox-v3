import { create } from "zustand";
import { Event, ImageData, MatchupContext } from "@lib/champdup";

export enum NotifyType {
  SUCCESS = "SUCCESS",
  FAIL = "FAIL",
  INFO = "INFO",
}

export type ChampdUpContext = {
  currentEvent: Event | null;
  previousEvent: Event | null;
  currentMatchup: MatchupContext | null;
  currentMatchupIdx: number | null;
  previousEventData: any;
  currentEventData: any;
  setCurrentEvent: (e: Event | null) => void;
  setCurrentEventData: (d: any) => void;
  setCurrentMatchup: (d: MatchupContext | null) => void;
  setCurrentMatchupIdx: (i: number | null) => void;
};

export const useChampdUpContext = create<ChampdUpContext>()((set) => ({
  currentEvent: null,
  currentEventData: null,
  previousEvent: null,
  previousEventData: null,
  currentMatchup: null,
  currentMatchupIdx: null,
  setCurrentMatchup: (d: MatchupContext | null) =>
    set(() => ({ currentMatchup: d })),
  setCurrentMatchupIdx: (i: number | null) =>
    set(() => ({ currentMatchupIdx: i })),
  setCurrentEvent: (e: Event | null) => set(() => ({ currentEvent: e })),
  setCurrentEventData: (d: any) => set(() => ({ currentEventData: d })),
}));
