import { create } from "zustand";
import { Event } from "@lib/champdup";

export enum NotifyType {
  SUCCESS = "SUCCESS",
  FAIL = "FAIL",
  INFO = "INFO",
}

export type ChampdUpContext = {
  currentEvent: Event | null;
  currentEventData: any;
  setCurrentEvent: (e: Event | null) => void;
  setCurrentEventData: (d: any) => void;
}

export const useChampdUpContext = create<ChampdUpContext>()((set) => ({
  currentEvent: null,
  currentEventData: null,
  setCurrentEvent: (e: Event | null) => set(() => ({currentEvent: e})),
  setCurrentEventData: (d: any) => set(() => ({currentEventData: d})),
}));
