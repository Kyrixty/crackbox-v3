import { GameStatus, useGameContext } from "@lib/context/game";
import { useUserContext } from "@lib/context/user";
import { Player } from "@lib/player";
import { Button, Card, Group, Image, Stack, Text, Title } from "@mantine/core";
import { isMobile } from "@utils/ismobile";
import { MessageType } from "@lib/champdup";
import { useEffect } from "react";
import "@/css/champdup.css";
import { ChatDrawer } from "../chat";
import { Poll } from "../poll";
import { useMessenger } from "@lib/context/ws";
import { useChampdUpContext } from "@lib/context/champdup";
import { HostComponent, StatusComponent } from "@components/conditional";
import { DevConsole } from "@components/dev";
import { ToHome } from "@components/home";
import { Disconnected } from "@components/disconnected";

const AVATAR_LARGE = 300;
const AVATAR_SMALL = 150;

const PlayerCard = ({ p }: { p: Player }) => {
  const imgSrc = p.avatar_data_url
    ? p.avatar_data_url
    : "/imgs/crackbox-logo-2.png";
  const im = !isMobile();
  const dm = im ? AVATAR_SMALL : AVATAR_LARGE;

  return (
    <Card className="player-card" bg={p.color} key={p.username} w={dm}>
      <Card.Section>
        <Image src={imgSrc} width={dm} height={dm} style={{backgroundSize: "cover", backgroundRepeat: "round"}} />
      </Card.Section>
      <Card.Section p={10}>
        <Group justify="center">
          <Title
            order={im ? 5 : 3}
            style={{
              color: "white",
              textShadow: "2px 2px 1px black",
              lineClamp: 1,
            }}
          >
            {p.username}
          </Title>
        </Group>
        <Text style={{ textShadow: "1px 1px 1px black" }}>
          <b>
            <i>{p.bio}</i>
          </b>
        </Text>
      </Card.Section>
    </Card>
  );
};

const Lobby = () => {
  const { players } = useGameContext();
  const { sendJsonMessage } = useMessenger<MessageType>();

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
      <Stack gap="md" align="center">
        <Group justify="center">
          {players.map((p) => (
            <PlayerCard p={p} />
          ))}
        </Group>
        <HostComponent>
          <Button
            onClick={() =>
              sendJsonMessage({
                type: MessageType.STATUS,
                value: GameStatus.RUNNING,
              })
            }
          >
            Start
          </Button>
        </HostComponent>
      </Stack>
    </div>
  );
};

const RunningComponent = () => {
  return (
    <div id="running-root" className="centered">
      <Text>This is the Running Component</Text>
    </div>
  );
};

export const ChampdUp = () => {
  const { lastJsonMessage } = useMessenger<MessageType>();
  const {
    currentEvent,
    currentEventData,
    setCurrentEvent,
    setCurrentEventData,
  } = useChampdUpContext();
  const { hostConnected, players, status } = useGameContext();

  useEffect(() => {
    if (lastJsonMessage === null) return;
    if (lastJsonMessage.type == MessageType.STATE) {
      setCurrentEvent(lastJsonMessage.value.event);
      setCurrentEventData(lastJsonMessage.value.event_data);
    }
  }, [lastJsonMessage]);

  return (
    <div id="champdup-root">
      <StatusComponent status_name={GameStatus.WAITING}>
        <Lobby />
      </StatusComponent>
      <StatusComponent status_name={GameStatus.RUNNING}>
        <RunningComponent />
      </StatusComponent>
      <StatusComponent status_name={GameStatus.STOPPED}>
        <Text>This is the Stopped Component</Text>
      </StatusComponent>
      <DevConsole
        get_game_state={() => {
          return {
            hostConnected,
            status,
            players,
            currentEvent,
            currentEventData,
          };
        }}
      />
      <ChatDrawer />
      <Poll />
      <div id="home-icon">
        <ToHome />
      </div>
      <Disconnected />
    </div>
  );
};
