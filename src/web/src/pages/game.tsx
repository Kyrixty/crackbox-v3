import { ChampdUp, MessageType } from "@components/champdup";
import { DevConsole } from "@components/dev";
import { useGameContext } from "@lib/context/game";
import { useUserContext } from "@lib/context/user";
import { useMessenger, JsonMessage, RJsonMessage } from "@lib/context/ws";
import { useEffect, useState } from "react";
import { ReadyState } from "react-use-websocket";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";

export const GamePage = () => {
  const g = useMessenger<MessageType>();
  const { gameId, setPlayers, setLastPlayer, reset } = useGameContext();
  const { isHost, ticket } = useUserContext();

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
    useWebSocket<RJsonMessage<MessageType> | null>(socketUrl);

  useEffect(() => {
    g.setSendJsonMessage(sendJsonMessage);
    g.setReadyState(readyState);
  }, []);

  useEffect(() => {
    if (lastJsonMessage !== null) {
      // setMessageHistory((prev) => prev.concat(lastJsonMessage)); // add later?
      g.setLastJsonMessage(lastJsonMessage);

      if (lastJsonMessage.type === MessageType.CONNECT) {
        setPlayers(lastJsonMessage.value.players);
        setLastPlayer(lastJsonMessage.value.target);
      }
    }
  }, [lastJsonMessage]);

  return (
    <div id="game-page-root">
      <DevConsole />
      {RESOLVE_PROPER_GAME()}
    </div>
  );
};
