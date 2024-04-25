import { DevConsole } from "@components/dev";
import { DrawAction, SketchPad } from "@components/sketch";
import { RJsonMessage, useMessenger, READYSTATE_MAP } from "@lib/context/ws";
import { Title } from "@mantine/core";
import { PathData } from "@utils/draw";
import { useEffect, useState } from "react";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";

enum MessageType {
  HOST_CONNECT = "HOST_CONNECT",
  HOST_DISCONNECT = "HOST_DISCONNECT",
  CONNECT = "CONNECT",
  DISCONNECT = "DISCONNECT",
  STATE = "STATE",
  STATUS = "STATUS",
  PING = "PING",
}

export const TestPage = () => {
  const submitPathData = (
    actionType: DrawAction,
    dUrl: string,
    title: string,
    data: PathData[]
  ) => {
    console.info({ actionType, dUrl, title, data });
  };

  const [socketUrl, setSocketUrl] = useState("ws://localhost:8000/game/test-multi-draw")
  const g = useMessenger();
  const { sendJsonMessage, lastJsonMessage, readyState } =
  useWebSocket<RJsonMessage<MessageType> | null>(socketUrl, {
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: (attempts: number) => {
      const delay = 5000;
      console.warn(`Connection lost, attempting to reconnect in ${delay/1000} seconds`)
      return delay;
    },
  });

  useEffect(() => {
    console.log("setting stuff", sendJsonMessage)
    g.setSendJsonMessage(sendJsonMessage);
    g.setReadyState(readyState);
  }, []);

  useEffect(() => {
    g.setReadyState(readyState);
  }, [readyState]);

  useEffect(() => {
    if (lastJsonMessage === null) return;
    g.setLastJsonMessage(lastJsonMessage);
  }, [lastJsonMessage])

  return (
    <div id="test-page-root">
      <SketchPad submitPathData={submitPathData} />
      <DevConsole get_game_state={() => {return {lastJsonMessage, readyState: READYSTATE_MAP[readyState]}}} />
    </div>
  );
};
