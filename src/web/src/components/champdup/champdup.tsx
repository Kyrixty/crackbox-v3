import {
  GameStatus,
  useGameContext,
  useGameStyleContext,
} from "@lib/context/game";
import { useUserContext } from "@lib/context/user";
import { Player } from "@lib/player";
import {
  ActionIcon,
  Affix,
  Avatar,
  Box,
  Button,
  Card,
  Grid,
  Group,
  HoverCard,
  Image,
  Indicator,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Transition,
} from "@mantine/core";
import { isDesktop, isMobile, isTablet } from "@utils/device";
import {
  AwardNames,
  EventNames,
  ImageData,
  SwapImage,
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
import {
  HostImageCandidate,
  HostMatchupController,
  PlayerVoteController,
} from "./image";
import { Carousel } from "@mantine/carousel";
import { darken } from "@mantine/core";
import Autoplay from "embla-carousel-autoplay";
import { IconUfo, IconVolume, IconVolumeOff } from "@tabler/icons-react";
import TextTransition, { presets } from "react-text-transition";
import { useTimer } from "react-timer-hook";
import { randomIntFromInterval } from "@utils/rand";
import { useSound } from "use-sound";
import lobbyTheme from "/audio/lobby.wav";
import drawTheme from "/audio/draw-1.mp3";
import vote3Theme from "/audio/vote-3.mp3";
import longNightTheme from "/audio/long-night.mp3";
import { PlayFunction } from "use-sound/dist/types";

import vote0sfx from "/audio/vote/vote0.wav";
import vote1sfx from "/audio/vote/vote1.wav";
import vote2sfx from "/audio/vote/vote2.wav";
import vote3sfx from "/audio/vote/vote3.wav";
import fight from "/audio/fight.mp3";
import { getSounds } from "@utils/sound";
import { FightBanner } from "./banners";

const AVATAR_LARGE = 300;
const AVATAR_SMALL = 150;
const VOLUME = 0.1;

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

  const key = "player-card-" + p.username;

  return (
    <Card
      key={key}
      className="player-card"
      bg={colorOverride ? colorOverride : p.color}
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

type AudioControls = {
  play: PlayFunction;
  stop: (id?: string | undefined) => void;
  sound: any;
};

const AudioController = () => {
  const { currentEvent } = useChampdUpContext();
  const [enabled, setEnabled] = useState(false);
  const [current, setCurrent] = useState<AudioControls | null>(null);
  const [previous, setPrevious] = useState<AudioControls | null>(null);
  const [lobbyPlay, { stop, sound }] = useSound(lobbyTheme, {
    volume: VOLUME,
    loop: true,
  });
  const [votePlay, { stop: voteStop, sound: voteSound }] = useSound(
    vote3Theme,
    {
      volume: VOLUME,
      loop: true,
    }
  );
  const [drawPlay, { stop: drawStop, sound: drawSound }] = useSound(drawTheme, {
    volume: VOLUME,
    loop: true,
  });
  const [endPlay, { stop: endStop, sound: endSound }] = useSound(
    longNightTheme,
    {
      volume: VOLUME,
      loop: true,
    }
  );
  const { status } = useGameContext();

  const resolveSound = () => {
    const stopIfCurrentExists = () => {
      if (current) {
        current.stop();
      }
    };
    if (!enabled) {
      if (current === null) return;
      current.stop();
      setCurrent(null);
      return;
    }
    if (status === GameStatus.WAITING) {
      setCurrent({ play: lobbyPlay, stop: stop, sound: sound });
      lobbyPlay();
      sound.fade(0, VOLUME, 1000);
    }
    if (
      currentEvent &&
      [
        EventNames.FirstVote,
        EventNames.SecondVote,
        EventNames.FirstDraw,
        EventNames.SecondDraw,
      ].includes(currentEvent.name)
    ) {
      if (current && current.play === votePlay) return;
      stopIfCurrentExists();
      setCurrent({ play: votePlay, stop: voteStop, sound: voteSound });
      votePlay();
      voteSound.fade(0, VOLUME, 1000);
    }
    if (
      currentEvent &&
      currentEvent.name === EventNames.Leaderboard &&
      status !== GameStatus.WAITING
    ) {
      stopIfCurrentExists();
      if (current && current.play === endPlay) return;
      setCurrent({ play: endPlay, stop: endStop, sound: endSound });
      endPlay();
    }
  };

  useEffect(resolveSound, [enabled]);

  useEffect(() => {
    if (!currentEvent) return;
    resolveSound();
  }, [currentEvent]);

  return (
    <ActionIcon
      color="white"
      variant="transparent"
      onClick={() => setEnabled(!enabled)}
    >
      {enabled ? <IconVolume /> : <IconVolumeOff />}
    </ActionIcon>
  );
};

const Lobby = () => {
  const { gameId, players } = useGameContext();
  const { sendJsonMessage } = useMessenger<MessageType>();
  const { isHost } = useUserContext();
  const im = isMobile();

  const GameIdTitle = () => {
    return (
      <>
        {isHost && (
          <Title
            order={1}
            style={{
              zIndex: 999,
              color: "white",
              fontSize: 50,
              textShadow: "-2px -2px black",
              background:
                "linear-gradient(90deg, rgba(255,134,17,1) 0%, rgba(0,0,0,1) 39%, rgba(255,0,0,1) 100%)",
              backgroundSize: "200% auto",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              WebkitBackgroundClip: "text",
              animation: "shine 1s linear infinite",
            }}
          >
            {gameId}
          </Title>
        )}
      </>
    );
  };

  if (players.length === 0) {
    return (
      <div id="lobby-root" className="centered">
        <Group justify="center">
          <Stack gap="md" align="center">
            <GameIdTitle />
            <Text color="white" style={{ textShadow: "2px 2px 1px black" }}>
              <b>No players yet, share the game code with your friends!</b>
            </Text>
          </Stack>
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
          <GameIdTitle />
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

const RUNNING_HOST_TEXTS = [
  "Don't forget to submit",
  "No gay drawings",
  "Crossing Carson's legs..",
  "FlipSide is a proud member of the LGBTQIA2S+ community! 🌈",
  "I didn't raid the clan, Jacob",
  "#LONGLIVEJANGOWU",
  "I think Jong Zho and Jamie Yim have conspired to take over the clan",
  "Sponsored by the CCP",
  "If you're seeing this message, the game broke :(",
  "You keep me up in more ways than one",
];

const RunningComponent = () => {
  const {
    currentEvent,
    currentEventData,
    setCurrentMatchup,
    setCurrentMatchupIdx,
  } = useChampdUpContext();
  const { players } = useGameContext();
  const { isHost } = useUserContext();
  const { lastJsonMessage } = useMessenger<MessageType>();
  const [matchup, setMatchup] = useState<MatchupContext | null>(null);
  const [matchupEnds, setMatchupEnds] = useState<Date | null>(null);
  const [leftVotes, setLeftVotes] = useState<string[]>([]);
  const [rightVotes, setRightVotes] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [leaderboardImgs, setLeaderboardImgs] = useState<LeaderboardImage[]>(
    []
  );
  const [textIdx, setTextIdx] = useState(0);
  const [_interval, _setInterval] = useState<number | null>(null);
  const [playersReady, setPlayersReady] = useState<string[]>([]);
  const [eventEnds, setEventEnds] = useState<Date>(new Date());
  const [swapImages, setSwapImages] = useState<SwapImage[]>([]);
  const [inGrace, setInGrace] = useState(false);
  const { setBg, setClassName } = useGameStyleContext();
  const autoplay = useRef(Autoplay({ delay: 4000 }));
  const voteSfxSounds = getSounds(
    [vote0sfx, vote1sfx, vote2sfx, vote3sfx],
    0.2
  );

  const [fightPlay] = useSound(fight, { volume: 0.5 });
  const [fMounted, setFMounted] = useState(false);

  const fBannerDuration = 500;

  const awardNamesIconMap = {
    [AwardNames.DOMINATION]: "/imgs/domination-icon.gif",
    [AwardNames.ON_FIRE]: "/imgs/on-fire-icon-crown.gif",
    [AwardNames.BRUH]: "/imgs/bruh-icon.gif",
    [AwardNames.COMEBACK]: "/imgs/comeback-icon.gif",
    [AwardNames.FAST]: "/imgs/fast-icon.gif",
    [AwardNames.PRIDE]: "/imgs/pride-icon.gif",
  };

  const awardNamesDescMap = {
    [AwardNames.DOMINATION]: "Received all votes!",
    [AwardNames.ON_FIRE]:
      "Didn't receive all votes but got at least double their opponent",
    [AwardNames.BRUH]: "Nobody voted at all...",
    [AwardNames.COMEBACK]: "Started off behind but brought it back",
    [AwardNames.FAST]:
      "The last change was within the first third of the round",
    [AwardNames.PRIDE]: "Makes JCL horny",
  };

  const TimerComponent = ({ expiryTimestamp }: { expiryTimestamp: Date }) => {
    const { minutes, seconds, start, pause } = useTimer({
      expiryTimestamp,
      autoStart: true,
    });

    return (
      <Title>
        {minutes == 0 ? "00" : minutes < 10 ? `0${minutes}` : minutes} :{" "}
        {seconds == 0 ? "00" : seconds < 10 ? `0${seconds}` : seconds}
      </Title>
    );
  };

  // Initial load
  useEffect(() => {
    if (_interval !== null) {
      clearInterval(_interval);
    }
    _setInterval(
      setInterval(() => {
        setTextIdx(randomIntFromInterval(0, RUNNING_HOST_TEXTS.length - 1));
      }, 5000)
    );
  }, []);

  useEffect(() => {
    console.info(lastJsonMessage);
    if (lastJsonMessage.type == MessageType.STATE) {
      if (lastJsonMessage.value.players_ready) {
        setPlayersReady(lastJsonMessage.value.players_ready);
      }
      if (lastJsonMessage.value.matchup) {
        setMatchup(lastJsonMessage.value.matchup);
        setCurrentMatchup(lastJsonMessage.value.matchup); // For child components that need to listen to changes
        setCurrentMatchupIdx(lastJsonMessage.value.idx);
        setLeftVotes(lastJsonMessage.value.matchup.leftVotes);
        setRightVotes(lastJsonMessage.value.matchup.rightVotes);
        setInGrace(lastJsonMessage.value.matchup.started);
      }
    }

    if (lastJsonMessage.type === MessageType.IMAGE_SWAP) {
      setMatchup(lastJsonMessage.value.matchup);
    }

    if (lastJsonMessage.type === MessageType.IMAGE_SUBMITS) {
      setPlayersReady(lastJsonMessage.value);
    }

    if (lastJsonMessage.type == MessageType.MATCHUP) {
      if (lastJsonMessage.value.swap_candidates) {
        setSwapImages(lastJsonMessage.value.swap_candidates);
      } else {
        setSwapImages([]);
      }
      setMatchupEnds(new Date(lastJsonMessage.value.ends));
      setMatchup(lastJsonMessage.value.matchup);
      setLeftVotes([]);
      setRightVotes([]);
      setInGrace(lastJsonMessage.value.matchup.started);
    }

    if (lastJsonMessage.type === MessageType.MATCHUP_START) {
      setInGrace(false);
      setFMounted(true);
    }

    if (lastJsonMessage.type == MessageType.MATCHUP_VOTE) {
      setLeftVotes(lastJsonMessage.value.left);
      setRightVotes(lastJsonMessage.value.right);
      const [voteSfxPlay] =
        voteSfxSounds[randomIntFromInterval(0, voteSfxSounds.length - 1)];
      if (isHost) {
        voteSfxPlay();
      }
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
    setPlayersReady([]);
    if (currentEvent === null) return;
    if (currentEvent.ends) {
      setEventEnds(new Date(currentEvent.ends));
    }
    if (currentEvent.name === EventNames.Leaderboard) {
      setBg(
        "white radial-gradient(#cbcbcb 40%, transparent 40%) 0px 0px/50px 50px round"
      );
      setClassName("translate-background-upper-right");
    } else if (
      [EventNames.FirstVote, EventNames.SecondVote].includes(currentEvent.name)
    ) {
      if (isHost) {
        setBg("black url('/imgs/crackbox-arena.gif') 0px 0px/cover round");
        setClassName("game-vote-class");
      }
    } else {
      setBg("black");
      setClassName("");
    }
  }, [currentEvent]);

  useEffect(() => {
    if (matchup === null) {
      console.log("No current matchup");
      return;
    }
    console.log(inGrace ? "CURRENTLY IN GRACE" : "CURRENTLY NOT IN GRACE");
  }, [inGrace]);

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
          <Stack align="center" gap="xl">
            <TimerComponent expiryTimestamp={eventEnds} />
            <Group justify="center">
              {players.map((p) => (
                <Indicator
                  position="bottom-end"
                  withBorder
                  inline
                  size={24}
                  offset={7}
                  processing={!playersReady.includes(p.username)}
                  color={playersReady.includes(p.username) ? "green" : "blue"}
                >
                  <Avatar
                    src={
                      p.avatar_data_url
                        ? p.avatar_data_url
                        : "/imgs/crackbox-logo-2.png"
                    }
                    size="xl"
                    color={p.color}
                  />
                </Indicator>
              ))}
            </Group>
            <TextTransition
              springConfig={presets.gentle}
              style={{ textShadow: "2px 2px 1px black" }}
            >
              {RUNNING_HOST_TEXTS[textIdx]}
            </TextTransition>
          </Stack>
        </HostComponent>
        <PlayerComponent>
          <SketchPad gameData={currentEventData} />
        </PlayerComponent>
      </EventComponent>
      <EventComponent name={[EventNames.FirstVote, EventNames.SecondVote]}>
        <HostComponent>
          <Affix top="10vh">
            <Transition
              mounted={fMounted}
              transition="slide-down"
              onEntered={() => {
                fightPlay();
                setTimeout(() => setFMounted(false), fBannerDuration * 2);
              }}
              duration={fBannerDuration}
              exitDuration={fBannerDuration}
            >
              {(styles) => (
                <Box style={{ ...styles }}>
                  <FightBanner />
                </Box>
              )}
            </Transition>
          </Affix>
          {matchup !== null && (
            <HostMatchupController
              left={{
                image: matchup.left,
                votes: leftVotes,
                totalVotes: leftVotes.length + rightVotes.length,
              }}
              right={{
                image: matchup.right,
                votes: rightVotes,
                totalVotes: leftVotes.length + rightVotes.length,
              }}
            />
          )}
          <Conditional condition={matchup === null}>
            <Text style={{ textShadow: "2px 2px 1px black" }}>
              Waiting for matchup data..
            </Text>
          </Conditional>
        </HostComponent>
        <PlayerComponent>
          {matchup !== null && (
            <PlayerVoteController
              inGrace={inGrace}
              swapImages={swapImages}
              matchup={matchup}
            />
          )}
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
                        <Box
                          bg={`linear-gradient(0deg, ${darken(
                            p.color,
                            0.5
                          )} 30%, ${p.color}`}
                          p={5}
                        >
                          <Group>
                            <Avatar
                              size="lg"
                              src={
                                p.avatar_data_url
                                  ? p.avatar_data_url
                                  : "/imgs/crackbox-logo-2.png"
                              }
                            />
                            <Text style={{ textShadow: "2px 2px 1px black" }}>
                              ${p.points}
                            </Text>
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
                          <Image w={400} src={img.image.dUri} />
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
                          <Group>
                            {img.awards.map((award) => {
                              return (
                                <HoverCard>
                                  <HoverCard.Target>
                                    <Image
                                      src={awardNamesIconMap[award.name]}
                                      w={75}
                                    />
                                  </HoverCard.Target>
                                  <HoverCard.Dropdown>
                                    <Text size="sm">
                                      {award.name} - ${award.bonus} -{" "}
                                      {awardNamesDescMap[award.name]}
                                    </Text>
                                  </HoverCard.Dropdown>
                                </HoverCard>
                              );
                            })}
                          </Group>
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
      <Affix position={{ bottom: "5vh", right: "5vw" }}>
        <Group justify="center">
          <HostComponent>
            <AudioController />
          </HostComponent>
        </Group>
      </Affix>
      <ChatDrawer />
      <Poll />
      <div id="home-icon">
        <ToHome />
      </div>
      <Disconnected />
    </div>
  );
};
