import { ChampdUp } from "@components/champdup/champdup";
import { MessageType } from "@lib/champdup";
import { DevConsole } from "@components/dev";
import {
  useGameContext,
  DefaultMessageType,
  useGameStyleContext,
} from "@lib/context/game";
import { useUserContext } from "@lib/context/user";
import { useMessenger, JsonMessage, RJsonMessage } from "@lib/context/ws";
import React, { useEffect, useState } from "react";
import { ReadyState } from "react-use-websocket";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";
import "@/css/game.css";
import { Box } from "@mantine/core";

export const GamePage = () => {
  const g = useMessenger<DefaultMessageType>();
  const { gameId, setPlayers, setLastPlayer, setStatus, setHostConnected } =
    useGameContext();
  const { isHost, ticket } = useUserContext();
  const { bg, className } = useGameStyleContext();
  const defaultStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
  };
  const [style, setStyle] = useState<React.CSSProperties>(defaultStyle)

  useEffect(() => setStyle({position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: bg, backgroundSize: "cover", backgroundRepeat: "round" }), [bg]);


  // : RESOLVERS

  const RESOLVE_GAME_MSG_TYPE = () => {
    // !!! IN FUTURE FIX ME TO RESOLVE FOR GAME SELECTED !!!
    return MessageType; // from champdup
  };

  const RESOLVE_PROPER_GAME = () => {
    // !!! IN FUTURE FIX ME TO RESOLVE FOR GAME SELECTED !!!
    return <ChampdUp />;
  };

  const resolveUrl = () => {
    // !!! CHECK FOR GAME EXISTS AND ELIGIBLE TO HOST/JOIN WITH TICKET !!!
    const mode = isHost ? "host" : "play";
    return `ws://localhost:8000/game/${mode}/${gameId}/${ticket}`;
  };

  // websocket
  const [socketUrl, setSocketUrl] = useState(resolveUrl());
  const [messageHistory, setMessageHistory] = useState<
    JsonMessage<MessageType>[]
  >([]);

  const { sendJsonMessage, lastJsonMessage, readyState } =
    useWebSocket<RJsonMessage<DefaultMessageType> | null>(socketUrl, {
      shouldReconnect: () => true,
      reconnectAttempts: 10,
      reconnectInterval: (attempts: number) => {
        const delay = 5000;
        console.warn(
          `Connection lost, attempting to reconnect in ${delay / 1000} seconds`
        );
        return delay;
      },
    });

  useEffect(() => {
    g.setSendJsonMessage(sendJsonMessage);
    g.setReadyState(readyState);
  }, []);

  useEffect(() => {
    g.setReadyState(readyState);
  }, [readyState]);

  useEffect(() => {
    if (lastJsonMessage !== null) {
      // setMessageHistory((prev) => prev.concat(lastJsonMessage)); // add later?
      g.setLastJsonMessage(lastJsonMessage);

      if (lastJsonMessage.ping) {
        g.setPing(lastJsonMessage.ping);
      }

      if (lastJsonMessage.type == DefaultMessageType.STATUS) {
        setStatus(lastJsonMessage.value);
      }

      if (lastJsonMessage.type == DefaultMessageType.STATE) {
        setHostConnected(lastJsonMessage.value.host_connected);
        setStatus(lastJsonMessage.value.status);
        setPlayers(lastJsonMessage.value.players);
      }

      if (lastJsonMessage.type === DefaultMessageType.CONNECT) {
        setPlayers(lastJsonMessage.value.players);
        setLastPlayer(lastJsonMessage.value.target);
      }

      if (lastJsonMessage.type === DefaultMessageType.DISCONNECT) {
        setPlayers(lastJsonMessage.value.players);
      }
    }
  }, [lastJsonMessage]);

  return (
    <div id="game-page-root">
      <Box className={className} id="game-page-bg" style={{...style, backgroundSize: "cover", backgroundRepeat: "round"}}></Box>
      {RESOLVE_PROPER_GAME()}
    </div>
  );
};
