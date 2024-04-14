export enum ConnectionStatus {
  CONNECTED = "CONNECTED",
  DISCONNECTED = "DISCONNECTED",
}

export type Player = {
  username: string;
  points: number;
  color: string;
  avatar_data_url: string;
  connection_status: ConnectionStatus;
};
