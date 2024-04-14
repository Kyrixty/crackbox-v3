import { useGameContext } from "@lib/context/game";
import { useUserContext } from "@lib/context/user";
import { Player } from "@lib/player";
import { Box, Card, Group, Image, Text, Title } from "@mantine/core";
import { isMobile } from "@utils/ismobile";
import { randomIntFromInterval } from "@utils/rand";
import { useCallback, useEffect, useState } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import "@/css/game.css";

const AVATAR_LARGE = 300;
const AVATAR_SMALL = 150;

enum MessageType {
  HOST_CONNECT = "HOST_CONNECT",
  HOST_DISCONNECT = "HOST_DISCONNECT",
  CONNECT = "CONNECT",
  DISCONNECT = "DISCONNECT",
  START = "START",
  STOP = "STOP",
  CHAT = "CHAT",
}

type JsonMessage = {
  type: MessageType;
  value: any;
};

const DESCRIPTORS = [
  "Loves sex on the beach",
  "Prefers baby dick over baby hands",
  "short",
  "PhD in Gayology",
  "Liberal",
  "Conservative Male",
  "I (35M) have a wife (32F). AITA?",
];

const getRandDescription = () => {
  const idx = randomIntFromInterval(0, DESCRIPTORS.length - 1);
  return DESCRIPTORS[idx];
};

const PlayerCard = ({ p }: { p: Player }) => {
  const [desc, setDesc] = useState(getRandDescription());
  const imgSrc = p.avatar_data_url
    ? p.avatar_data_url
    : "/imgs/crackbox-logo-2.png";
  const im = !isMobile();
  const dm = im ? AVATAR_SMALL : AVATAR_LARGE;

  return (
    <Card className="player-card" bg={p.color} key={p.username} w={dm}>
      <Card.Section>
        <Image src={imgSrc} width={dm} height={dm} />
      </Card.Section>
      <Card.Section p={10}>
        <Group justify="center">
          <Title
            order={im ? 5 : 3}
            style={{
              color: "white",
              textShadow: "0px 0px 3px black",
              lineClamp: 1,
            }}
          >
            {p.username}
          </Title>
        </Group>
        <Text>
          <i>{desc}</i>
        </Text>
      </Card.Section>
    </Card>
  );
};

const Lobby = () => {
  const { players } = useGameContext();

  if (players.length === 0) {
    return (
      <div id="lobby-root" className="centered">
        <Group justify="center">
          <Text>No players yet, share the game code with your friends!</Text>
        </Group>
      </div>
    );
  }

  return (
    <div id="lobby-root" className="centered">
      <Group justify="center">
        {players.map((p) => (
          <PlayerCard p={p} />
        ))}
      </Group>
    </div>
  );
};

export const GamePage = () => {
  const { username, isHost, token, ticket } = useUserContext();
  const { gameId, setPlayers } = useGameContext();
  useEffect(() => {
    console.log("ON LOAD");
    console.log({ username, isHost, token, ticket, gameId });
  }, []);

  const resolveUrl = () => {
    const mode = isHost ? "host" : "play";
    return `ws://localhost:8000/game/${mode}/${gameId}/${ticket}`;
  };

  // websocket
  const [socketUrl, setSocketUrl] = useState(resolveUrl());
  const [messageHistory, setMessageHistory] = useState<JsonMessage[]>([]);

  const { sendJsonMessage, lastJsonMessage, readyState } =
    useWebSocket<JsonMessage | null>(socketUrl);

  useEffect(() => {
    if (lastJsonMessage !== null) {
      setMessageHistory((prev) => prev.concat(lastJsonMessage));
      if (lastJsonMessage.type === MessageType.CONNECT) {
        setPlayers(lastJsonMessage.value);
      }
    }
  }, [lastJsonMessage]);

  const handleClickChangeSocketUrl = useCallback(
    () => setSocketUrl("wss://demos.kaazing.com/echo"),
    []
  );

  const handleClickSendMessage = useCallback(
    () => sendJsonMessage("Hello"),
    []
  );

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  return (
    <div id="game-page-root">
      <Lobby />
    </div>
  );
};
