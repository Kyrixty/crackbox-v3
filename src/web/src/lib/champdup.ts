import { Player } from "./player";

export enum MessageType {
  HOST_CONNECT = "HOST_CONNECT",
  HOST_DISCONNECT = "HOST_DISCONNECT",
  STATE = "STATE",
  STATUS = "STATUS",
  CONNECT = "CONNECT",
  DISCONNECT = "DISCONNECT",
  CHAT = "CHAT",
  PM = "PM",
  NOTIFY = "NOTIFY",
  POLL = "POLL",
  POLL_VOTE = "POLL_VOTE",
  IMAGE = "IMAGE",
  MATCHUP = "MATCHUP",
  MATCHUP_VOTE = "MATCHUP_VOTE",
  MATCHUP_RESULT = "MATCHUP_RESULT",
}

export enum EventNames {
  FirstDraw = "D1",
  FirstCounter = "C1",
  FirstVote = "V1",
  SecondDraw = "D2",
  SecondCounter = "C2",
  SecondVote = "V2",
  BonusRound = "B",
  Leaderboard = "L",
}

export type Event = {
  name: EventNames;
  timed: boolean;
  ends: string | null;
}

export type ImageData = {
  artists: Player[];
  dUri: string;
  title: string;
};

export type MatchupContext = {
  left: ImageData;
  leftVotes: string[];
  right: ImageData;
  rightVotes: string[];
};

export enum NotifyType {
  SUCCESS = "SUCCESS",
  FAIL = "FAIL",
  INFO = "INFO",
}