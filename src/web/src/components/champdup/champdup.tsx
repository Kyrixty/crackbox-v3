import { GameStatus, useGameContext } from "@lib/context/game";
import { useUserContext } from "@lib/context/user";
import { Player } from "@lib/player";
import {
  Avatar,
  Button,
  Card,
  Grid,
  Group,
  Image,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { isDesktop, isMobile, isTablet } from "@utils/device";
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
import { CrackboxLogoGrid } from "@components/crackbox";

const AVATAR_LARGE = 300;
const AVATAR_SMALL = 150;

const PlayerCard = ({ p }: { p: Player }) => {
  const { players } = useGameContext();
  const imgSrc = p.avatar_data_url
    ? p.avatar_data_url
    : "/imgs/crackbox-logo-2.png";
  const tablet = isTablet();
  const desktop = isDesktop();
  const dm = players.length > 6 || tablet ? AVATAR_SMALL : AVATAR_LARGE;

  return (
    <Card
      className="player-card"
      bg={p.color}
      key={p.username}
      w={dm}
      shadow="lg"
      style={{ boxShadow: "1px 1px 12px 4px black" }}
    >
      <Card.Section>
        <Image
          src={imgSrc}
          width={dm}
          height={dm}
          style={{ backgroundSize: "cover", backgroundRepeat: "round" }}
        />
      </Card.Section>
      <Card.Section p={10}>
        <Group justify="center">
          <Title
            order={tablet ? 5 : 3}
            style={{
              color: "white",
              textShadow: "2px 2px 1px black",
              lineClamp: 1,
            }}
          >
            {p.username}
          </Title>
        </Group>
        <Text
          size={dm === AVATAR_SMALL ? "sm" : "md"}
          style={{ textShadow: "1px 1px 1px black" }}
        >
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
  const im = isMobile();

  if (players.length === 0) {
    return (
      <div id="lobby-root" className="centered">
        <Group justify="center">
          <Text color="white" style={{ textShadow: "2px 2px 1px black" }}>
            <b>No players yet, share the game code with your friends!</b>
          </Text>
        </Group>
      </div>
    );
  }

  return (
    <div id="lobby-root">
      <Group justify="center">
        <Stack align="center">
          <SimpleGrid cols={players.length > 6 ? 5 : 3}>
            {players.map((p) => {
              return (
                <>
                  {im ? (
                    <Avatar style={{ boxShadow: "1px 1px 12px 4px black" }} size="xl" src={p.avatar_data_url} />
                  ) : (
                    <PlayerCard p={p} />
                  )}
                </>
              );
            })}
          </SimpleGrid>
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
      </Group>
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
  const { lastJsonMessage, ping } = useMessenger<MessageType>();
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
        <CrackboxLogoGrid />
        <Lobby />
      </StatusComponent>
      <StatusComponent status_name={GameStatus.RUNNING}>
        <RunningComponent />
      </StatusComponent>
      <StatusComponent status_name={GameStatus.STOPPED}>
        <Text>The game is no longer active, please try connecting to another game.</Text>
      </StatusComponent>
      <DevConsole
        get_game_state={() => {
          return {
            ping,
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
