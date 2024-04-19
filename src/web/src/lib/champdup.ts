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

export enum Event {
  FirstDraw = "D1",
  FirstCounter = "C1",
  FirstVote = "V1",
  SecondDraw = "D2",
  SecondCounter = "C2",
  SecondVote = "V2",
  BonusRound = "B",
}