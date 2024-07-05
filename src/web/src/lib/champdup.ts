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
  SPONSOR = "SPONSOR",
  QUAHOG = "QUAHOG",
  PATH = "PATH",
  CLEAR = "CLEAR",
  IMAGE = "IMAGE",
  IMAGE_SUBMITS = "IMAGE_SUBMITS",
  IMAGE_SWAP = "IMAGE_SWAP",
  MATCHUP = "MATCHUP",
  MATCHUP_START = "MATCHUP_START",
  MATCHUP_VOTE = "MATCHUP_VOTE",
  MATCHUP_RESULT = "MATCHUP_RESULT",

  FORCE_NEXT_MATCHUP = "FORCE_NEXT_MATCHUP",
}

export enum EventNames {
  FirstDraw = "D1",
  FirstCounter = "C1",
  FirstVote = "V1",
  SecondDraw = "D2",
  SecondCounter = "C2",
  SecondVote = "V2",
  BonusDraw = "BD",
  BonusCounter = "BC",
  BonusVote = "BV",
  Leaderboard = "L",
}

export type Event = {
  name: EventNames;
  timed: boolean;
  ends: string | null;
};

export type ImageData = {
  artists: Player[];
  points: number;
  prompt: string;
  dUri: string;
  title: string;
  last_changed: string;
};

export type SwapImage = {
  image: ImageData;
  image_hash: string;
};

export enum AwardNames {
  DOMINATION = "DOMINATION",
  ON_FIRE = "ON_FIRE",
  BRUH = "BRUH",
  PRIDE = "PRIDE",
  FAST = "FAST",
  COMEBACK = "COMEBACK",
}

export type Award = {
  name: AwardNames;
  bonus: number;
};

export type LeaderboardImage = {
  image: ImageData;
  awards: Award[];
};

export type MatchupContext = {
  left: ImageData;
  leftVotes: string[];
  right: ImageData;
  rightVotes: string[];
  initial_leader: "left" | "right";
  started: boolean;
};

export enum NotifyType {
  SUCCESS = "SUCCESS",
  FAIL = "FAIL",
  INFO = "INFO",
}
