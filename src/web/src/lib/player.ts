export enum ConnectionStatus {
  CONNECTED = "CONNECTED",
  DISCONNECTED = "DISCONNECTED",
}

export type Player = {
  username: string;
  is_host: boolean;
  bio: string;
  points: number;
  color: string;
  avatar_data_url: string;
  connection_status: ConnectionStatus;
};
