import {
  GameStatus,
  useGameContext,
  useGameStyleContext,
} from "@lib/context/game";
import { useUserContext } from "@lib/context/user";
import { Player } from "@lib/player";
import {
  Avatar,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Image,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { isDesktop, isMobile, isTablet } from "@utils/device";
import {
  AwardNames,
  EventNames,
  ImageData,
  LeaderboardImage,
  MatchupContext,
  MessageType,
} from "@lib/champdup";
import { useEffect, useRef, useState } from "react";
import "@/css/champdup.css";
import { ChatDrawer } from "../chat";
import { Poll } from "../poll";
import { useMessenger, READYSTATE_MAP } from "@lib/context/ws";
import { useChampdUpContext } from "@lib/context/champdup";
import {
  Conditional,
  HostComponent,
  PlayerComponent,
  StatusComponent,
} from "@components/conditional";
import { DevConsole } from "@components/dev";
import { ToHome } from "@components/home";
import { Disconnected } from "@components/disconnected";
import { CrackboxLogoGrid } from "@components/crackbox";
import { EventComponent } from "./conditional";
import { SketchPad } from "@components/sketch";
import { HostImageCandidate, PlayerVoteController } from "./image";
import { Carousel } from "@mantine/carousel";
import { darken } from "@mantine/core";
import Autoplay from "embla-carousel-autoplay";
import { IconUfo } from "@tabler/icons-react";

const AVATAR_LARGE = 300;
const AVATAR_SMALL = 150;

const PlayerCard = ({
  p,
  colorOverride,
  forceSmall,
}: {
  p: Player;
  colorOverride?: string | undefined;
  forceSmall?: boolean | undefined;
}) => {
  const { players } = useGameContext();
  const imgSrc = p.avatar_data_url
    ? p.avatar_data_url
    : "/imgs/crackbox-logo-2.png";
  const tablet = isTablet();
  const desktop = isDesktop();
  const dm =
    forceSmall || players.length > 6 || tablet ? AVATAR_SMALL : AVATAR_LARGE;

  return (
    <Card
      className="player-card"
      bg={colorOverride ? colorOverride : p.color}
      key={p.username}
      w={dm}
      style={{
        boxShadow: `1px 1px 12px 4px ${
          colorOverride ? colorOverride : p.color
        }`,
      }}
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
            order={dm === AVATAR_SMALL ? 5 : 3}
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
                    <Avatar
                      style={{
                        boxShadow: `1px 1px 12px 4px ${p.color}`,
                        backgroundColor: p.color,
                      }}
                      size="xl"
                      src={
                        p.avatar_data_url
                          ? p.avatar_data_url
                          : "/imgs/crackbox-logo-2.png"
                      }
                    />
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

const LeaderboardCard = ({
  p,
  colorOverride,
  forceSmall,
}: {
  p: Player;
  colorOverride?: string | undefined;
  forceSmall?: boolean | undefined;
}) => {
  return (
    <Stack>
      <PlayerCard p={p} colorOverride={colorOverride} forceSmall={forceSmall} />
      <Box p={5} bg={colorOverride ? colorOverride : p.color}>
        <Group justify="space-around">
          <Title order={4} style={{ color: "black" }}>
            ${p.points}
          </Title>
        </Group>
      </Box>
    </Stack>
  );
};

const RunningComponent = () => {
  const { currentEvent, currentEventData } = useChampdUpContext();
  const { lastJsonMessage } = useMessenger<MessageType>();
  const [matchup, setMatchup] = useState<MatchupContext | null>(null);
  const [matchupEnds, setMatchupEnds] = useState<Date | null>(null);
  const [leftVotes, setLeftVotes] = useState<string[]>([]);
  const [rightVotes, setRightVotes] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [leaderboardImgs, setLeaderboardImgs] = useState<LeaderboardImage[]>([]);
  const { setBg, setClassName } = useGameStyleContext();
  const autoplay = useRef(Autoplay({ delay: 4000 }));

  useEffect(() => {
    if (lastJsonMessage.type == MessageType.STATE) {
      if (lastJsonMessage.value.matchup) {
        setMatchup(lastJsonMessage.value.matchup);
        setLeftVotes(lastJsonMessage.value.matchup.leftVotes);
        setRightVotes(lastJsonMessage.value.matchup.rightVotes);
      }
    }
    if (lastJsonMessage.type == MessageType.MATCHUP) {
      setMatchupEnds(new Date(lastJsonMessage.value.ends));
      setMatchup(lastJsonMessage.value.matchup);
      setLeftVotes([]);
      setRightVotes([]);
    }

    if (lastJsonMessage.type == MessageType.MATCHUP_VOTE) {
      setLeftVotes(lastJsonMessage.value.left);
      setRightVotes(lastJsonMessage.value.right);
    }
  }, [lastJsonMessage]);

  useEffect(() => {
    if (currentEventData === null || currentEventData === undefined) return;
    if (currentEventData.leaderboard && currentEventData.leaderboard_images) {
      setLeaderboard(currentEventData.leaderboard);
      setLeaderboardImgs(currentEventData.leaderboard_images);
    }
  }, [currentEventData]);

  useEffect(() => {
    if (currentEvent === null) return;
    if (currentEvent.name === EventNames.Leaderboard) {
      setBg(
        "white radial-gradient(#cbcbcb 40%, transparent 40%) 0px 0px/50px 50px round"
      );
      setClassName("translate-background-upper-right");
    } else {
      setBg("black");
      setClassName("");
    }
  }, [currentEvent]);

  return (
    <div id="running-root" className="centered">
      <EventComponent
        name={[
          EventNames.FirstDraw,
          EventNames.FirstCounter,
          EventNames.SecondDraw,
          EventNames.SecondCounter,
        ]}
      >
        <HostComponent>
          <Text style={{ textShadow: "2px 2px 1px black" }}>
            Waiting for players to finish drawing..
          </Text>
        </HostComponent>
        <PlayerComponent>
          <SketchPad gameData={currentEventData} />
        </PlayerComponent>
      </EventComponent>
      <EventComponent name={[EventNames.FirstVote, EventNames.SecondVote]}>
        <HostComponent>
          {matchup !== null && (
            <Group justify="space-around">
              <SimpleGrid cols={2}>
                <HostImageCandidate
                  image={matchup.left}
                  votes={leftVotes}
                  totalVotes={leftVotes.length + rightVotes.length}
                />
                <HostImageCandidate
                  image={matchup.right}
                  votes={rightVotes}
                  totalVotes={leftVotes.length + rightVotes.length}
                />
              </SimpleGrid>
            </Group>
          )}
          <Conditional condition={matchup === null}>
            <Text style={{ textShadow: "2px 2px 1px black" }}>
              Waiting for matchup data..
            </Text>
          </Conditional>
        </HostComponent>
        <PlayerComponent>
          {matchup !== null && <PlayerVoteController matchup={matchup} />}
          {matchup === null && (
            <Text style={{ textShadow: "2px 2px 1px black" }}>
              Waiting for matchup data..
            </Text>
          )}
        </PlayerComponent>
      </EventComponent>
      <EventComponent name={[EventNames.Leaderboard]}>
        <HostComponent>
          <div id="leaderboard-root">
            {leaderboard.length && leaderboardImgs.length && (
              <Group justify="space-around">
                <Stack align="center">
                  <Group justify="space-around">
                    <LeaderboardCard
                      p={leaderboard[0]}
                      colorOverride="#FFD700"
                      forceSmall={leaderboard.length > 3}
                    />
                  </Group>
                  <SimpleGrid cols={2}>
                    <LeaderboardCard
                      p={leaderboard[1]}
                      colorOverride="#C0C0C0"
                      forceSmall={leaderboard.length > 3}
                    />
                    <LeaderboardCard
                      p={leaderboard[2]}
                      colorOverride="#CD7F32"
                      forceSmall={leaderboard.length > 3}
                    />
                  </SimpleGrid>
                  {leaderboard.length > 3 && (
                    <ScrollArea w="100%" offsetScrollbars>
                      {leaderboard.slice(3).map((p) => (
                        <Box bg={`linear-gradient(0deg, ${darken(p.color, 0.5)} 30%, ${p.color}`} p={5}>
                          <Group>
                            <Avatar
                              size="lg"
                              src={
                                p.avatar_data_url
                                  ? p.avatar_data_url
                                  : "/imgs/crackbox-logo-2.png"
                              }
                            />
                            <Text>${p.points}</Text>
                          </Group>
                        </Box>
                      ))}
                    </ScrollArea>
                  )}
                </Stack>
                <div style={{ height: 700, display: "flex" }}>
                  <Carousel
                    withControls={false}
                    orientation="vertical"
                    slideSize="100%"
                    height="100%"
                    style={{ flex: 1 }}
                    plugins={[autoplay.current]}
                    onMouseLeave={() => autoplay.current.play()}
                  >
                    {leaderboardImgs.map((img) => (
                      <Carousel.Slide>
                        <Stack align="center">
                          <Box
                            p={20}
                            bg="black"
                            style={{ transform: "skewX(-10deg)" }}
                          >
                            <Title order={3}>{img.image.title}</Title>
                          </Box>
                          <Image src={img.image.dUri} />
                          <Group>
                            {img.image.artists.map((p) => (
                              <Group>
                                <Avatar
                                  size="lg"
                                  src={
                                    p.avatar_data_url
                                      ? p.avatar_data_url
                                      : "/imgs/crackbox-logo-2.png"
                                  }
                                  style={{
                                    backgroundColor: p.color,
                                    boxShadow: `1px 1px 12px 4px ${p.color}`,
                                  }}
                                />
                                <Title order={4} style={{ color: "black" }}>
                                  {p.username}
                                </Title>
                              </Group>
                            ))}
                          </Group>
                          <Group>{img.awards.map((award) => {
                            if (award.name !== AwardNames.DOMINATION) return <></>;
                            return <Image src="/imgs/domination-icon-big.gif" w={50} />;
                          })}</Group>
                        </Stack>
                      </Carousel.Slide>
                    ))}
                  </Carousel>
                </div>
              </Group>
            )}
          </div>
        </HostComponent>
        <PlayerComponent>
          <Box p={20} bg="black">
            <Title style={{ color: "white", textAlign: "center" }} order={2}>
              View the leaderboard on the host's screen!
            </Title>
          </Box>
        </PlayerComponent>
      </EventComponent>
    </div>
  );
};

export const ChampdUp = () => {
  const { lastJsonMessage, ping, readyState } = useMessenger<MessageType>();
  const {
    currentEvent,
    currentEventData,
    setCurrentEvent,
    setCurrentEventData,
  } = useChampdUpContext();
  const { gameId, hostConnected, players, status } = useGameContext();
  const rs = READYSTATE_MAP[readyState];

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
        <Text>
          The game is no longer active, please try connecting to another game.
        </Text>
      </StatusComponent>
      <DevConsole
        get_game_state={() => {
          return {
            gameId,
            rs,
            ping,
            hostConnected,
            status,
            lastJsonMessage,
            currentEvent,
            currentEventData,
            players,
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
