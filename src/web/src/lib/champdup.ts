export enum MessageType {
  HOST_CONNECT = "HOST_CONNECT",
  HOST_DISCONNECT = "HOST_DISCONNECT",
  STATE = "STATE",
  STATUS = "STATUS",
  CONNECT = "CONNECT",
  DISCONNECT = "DISCONNECT",
  CHAT = "CHAT",
  PM = "PM",
  POLL = "POLL",
  POLL_VOTE = "POLL_VOTE",
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
  author: string;
  img_data_url: string;
  title: string;
};

export type MatchupContext = {
  imgs: ImageData[];
  imgVotes: number[];

  setImgs: (i: ImageData[]) => void;
  setImgVotes: (v: number[]) => void;
  resetMatchup: () => void;
};