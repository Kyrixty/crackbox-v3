import {
  EventNames,
  ImageData,
  MatchupContext,
  SwapImage,
} from "@lib/champdup";
import { useMessenger } from "@lib/context/ws";
import {
  Affix,
  Avatar,
  Box,
  Card,
  Group,
  Image,
  Overlay,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Transition,
} from "@mantine/core";
import { MessageType } from "@lib/champdup";
import { CSSProperties, useEffect, useState } from "react";
import { useUserContext } from "@lib/context/user";
import { Player } from "@lib/player";
import { useChampdUpContext } from "@lib/context/champdup";
import whoosh1 from "/audio/whoosh1.mp3";
import useSound from "use-sound";
import { randomIntFromInterval } from "@utils/rand";
import { useGameStyleContext } from "@lib/context/game";
import { getColorRepresentation } from "@utils/color";
import ProgressBar from "@ramonak/react-progress-bar";
import CountUp from "react-countup";

import godlike from "/audio/godlike.mp3";
import holy from "/audio/holy.mp3";
import therapy from "/audio/therapy.mp3";
import fire from "/audio/fire.wav";
import coins from "/audio/coins.wav";
import boxingbell from "/audio/boxing-bell.mp3";
import money from "/audio/money-counter.mp3";

import { getSounds } from "@utils/sound";
import { PromptBanner } from "./banners";
import "@/css/image.css";

const VOLUME = 0.1;
const DURATION = 1000; //ms

export interface ImageCandidateProps {
  image?: ImageData;
  votes: string[];
  totalVotes: number;
}

export interface HostImageCandidateProps extends ImageCandidateProps {
  isLeft?: boolean;
}

export interface HostMatchupControllerProps {
  left: ImageCandidateProps;
  right: ImageCandidateProps;
}

export const HostMatchupController = ({
  left,
  right,
}: HostMatchupControllerProps) => {
  const [mIdx, setmIdx] = useState(-1);
  const [leftMounted, setLeftMounted] = useState(false);
  const [rightMounted, setRightMounted] = useState(false);
  const [playWhoosh1] = useSound(whoosh1, { volume: VOLUME });
  const { lastJsonMessage, sendJsonMessage } = useMessenger<MessageType>();
  const { currentMatchup } = useChampdUpContext();

  const [leftImg, setLeftImg] = useState<ImageData | undefined>();
  const [rightImg, setRightImg] = useState<ImageData | undefined>();
  const [prompt, setPrompt] = useState("");

  const [pMounted, setPMounted] = useState(false);
  const [bellPlay] = useSound(boxingbell, {volume: 0.1});

  const handleNewMatchup = (leftImage: ImageData, rightImage: ImageData) => {
    setLeftImg(leftImage);
    setLeftMounted(true);
    setPrompt(leftImage.prompt);
    setTimeout(() => {
      setRightImg(rightImage);
      setRightMounted(true);
    }, DURATION * 2);
  };

  const onEnter = () => {
    const whooshes = [playWhoosh1]; // in case we add more
    const idx = randomIntFromInterval(0, whooshes.length - 1);
    whooshes[idx]();
  };

  const onRightExited = () => {
    // kill grace period
  };

  useEffect(() => {
    if (currentMatchup === null) {
      setLeftMounted(false);
      setRightMounted(false);
      return;
    }
    setLeftImg(currentMatchup.left);
    setRightImg(currentMatchup.right);
  }, [currentMatchup]);

  useEffect(() => {
    if (lastJsonMessage === null) return;
    if (lastJsonMessage.type === MessageType.MATCHUP) {
      if (lastJsonMessage.value.idx === mIdx) return;
      setmIdx(lastJsonMessage.value.idx);
      setLeftMounted(false);
      setRightMounted(false);
      setPMounted(false);
      setTimeout(
        () =>
          handleNewMatchup(
            lastJsonMessage.value.matchup.left,
            lastJsonMessage.value.matchup.right
          ),
        DURATION * 2
      );
    }
    if (lastJsonMessage.type === MessageType.IMAGE_SWAP) {
      const target: "left" | "right" = lastJsonMessage.value.target;
      if (target === "left") {
        setLeftMounted(false);
        setTimeout(() => {
          setLeftImg(lastJsonMessage.value.matchup.left);
          setLeftMounted(true);
        }, DURATION * 2);
      }
      if (target === "right") {
        setRightMounted(false);
        setTimeout(() => {
          setRightImg(lastJsonMessage.value.matchup.right);
          setRightMounted(true);
        }, DURATION * 2);
      }
    }
    if (lastJsonMessage.type === MessageType.MATCHUP_RESULT) {
      bellPlay();
    }
  }, [lastJsonMessage]);

  return (
    <Box w="100vw" p="20vw">
      <Group justify={"space-between"}>
        <Transition
          mounted={leftMounted}
          transition="slide-right"
          duration={DURATION}
          onEnter={onEnter}
        >
          {(styles) => (
            <Box style={{ ...styles }}>
              <HostImageCandidate
                isLeft
                image={leftImg}
                votes={left.votes}
                totalVotes={left.totalVotes}
              />
            </Box>
          )}
        </Transition>
        {!leftMounted && <Box miw={10} />}
        <Transition
          mounted={rightMounted}
          transition="slide-left"
          duration={DURATION}
          onEnter={onEnter}
          onExited={onRightExited}
          onEntered={() => setTimeout(() => setPMounted(true), 1000)}
        >
          {(styles) => (
            <Box style={{ ...styles }}>
              <HostImageCandidate
                image={rightImg}
                votes={right.votes}
                totalVotes={right.totalVotes}
              />
            </Box>
          )}
        </Transition>
      </Group>
      <Affix bottom="5vh">
        <Transition
          mounted={pMounted}
          transition="slide-up"
          duration={1000}
          exitDuration={500}
        >
          {(styles) => {
            if (!left.image) return <></>;
            return (
              <Box style={{ ...styles }}>
                <PromptBanner prompt={prompt} />
              </Box>
            );
          }}
        </Transition>
      </Affix>
    </Box>
  );
};

interface ArtistCreditsProps {
  img: ImageData;
  points: number;
  playSfx: boolean;
}

const ArtistCredits = ({ img, playSfx, points }: ArtistCreditsProps) => {
  const [coinsPlay] = useSound(coins, { volume: 0.5 });
  return (
    <Stack align="center">
      <Group justify="center">
        {img.artists.map((artist) => (
          <Avatar
            style={{boxShadow: "0px 0px 3px black"}}
            variant="filled"
            src={
              artist.avatar_data_url
                ? artist.avatar_data_url
                : "/imgs/crackbox-logo-2.png"
            }
            size="lg"
            color={artist.color}
          />
        ))}
      </Group>
      <CountUp
        onEnd={() => {
          coinsPlay();
        }}
        start={0}
        separator=","
        end={points}
        duration={3}
        delay={0}
      >
        {({ countUpRef }) => (
          <div>
            <Title
              c="lime"
              order={3}
              style={{ textShadow: "2px 2px 1px black" }}
            >
              $<span ref={countUpRef} />
            </Title>
          </div>
        )}
      </CountUp>
    </Stack>
  );
};

export const HostImageCandidate = ({
  image,
  votes,
  totalVotes,
  isLeft,
}: HostImageCandidateProps) => {
  if (!image) return <></>;
  const [fireCache, setFireCache] = useState(false);

  useEffect(() => {
    console.log(votes);
    const onFire = votesPct >= 70;
    if (onFire) {
      if (!fireCache) {
        if (fireStop) {
          fireStop();
        }
        firePlay();
        const [play, {stop}] = sounds[randomIntFromInterval(0, sounds.length - 1)];
        play();
        setFireStop(stop);
      }
    }
    setFireCache(onFire);
  }, [votes]);

  const sounds = getSounds([godlike, holy, therapy], 0.1);
  const [firePlay] = useSound(fire, { volume: 0.3 });
  const [started, setStarted] = useState(false);
  const [blur, setBlur] = useState(false);
  const { lastJsonMessage } = useMessenger<MessageType>();
  const [points, setPoints] = useState(0);
  const [moneySfx] = useSound(money, {volume: 0.03});
  const [fireStop, setFireStop] = useState<null | (() => void)>(null);

  const skew = isLeft ? "-10deg" : "10deg";
  const votesPct = (votes.length / totalVotes) * 100;

  const titleBg = `linear-gradient(90deg, ${getColorRepresentation(
    votesPct
  )} ${votesPct}%, rgba(40,40,40,0) ${votesPct}%)`;
  const order = image.title.length > 40 ? 4 : 3;

  const onFire = votesPct >= 70;

  const style: CSSProperties = onFire
    ? {
        backgroundImage: "url('/imgs/fire.gif')",
        backgroundSize: "cover",
        backgroundRepeat: "round",
      }
    : {};

  useEffect(() => {
    if (lastJsonMessage === null) return;
    if (
      [MessageType.MATCHUP, MessageType.MATCHUP_START].includes(
        lastJsonMessage.type
      )
    ) {
      setBlur(false);
    }
    if (lastJsonMessage.type === MessageType.MATCHUP_RESULT) {
      if (isLeft) {
        setPoints(lastJsonMessage.value.left_points);
      } else {
        setPoints(lastJsonMessage.value.right_points);
      }
      console.log(lastJsonMessage.value.left_points);
      console.log(lastJsonMessage.value.right_points);
      setTimeout(() => {setBlur(true); moneySfx()}, 2000);
    }
    if (lastJsonMessage.type === MessageType.MATCHUP_START) {
      setStarted(true);
      setBlur(false);
    }
    if (
      lastJsonMessage.type === MessageType.MATCHUP ||
      lastJsonMessage.type === MessageType.MATCHUP_RESULT
    ) {
      setStarted(false);
    }
  }, [lastJsonMessage]);

  return (
    <Stack align="center" w={300} gap="lg">
      <Box p={20} bg="black" style={{ transform: `skewX(${skew})` }}>
        <Title c="white" order={order}>
          {image.title}
        </Title>
        {/* <Box p={5} bg={titleBg} w="100%" /> */}
        <ProgressBar
          completed={votesPct ? votesPct : 0}
          isLabelVisible={false}
          labelColor="#ffffff"
          baseBgColor="rgb(40,40,40)"
          bgColor={getColorRepresentation(votesPct)}
          transitionDuration="0.25s"
          maxCompleted={100}
          borderRadius={"0px"}
        />
      </Box>
      <Group justify="center"></Group>
      <Image
        className={started ? "host-image-candidate" : ""}
        style={style}
        src={image.dUri}
        w={300}
      />
      <Box pos="absolute" top="50%" left="50%">
        <Transition mounted={blur} transition="slide-down">
          {(styles) => (
            <Box style={{ ...styles }} w="100%">
              <ArtistCredits playSfx={!!isLeft} img={image} points={points} />
            </Box>
          )}
        </Transition>
      </Box>
    </Stack>
  );
};

type CANDIDATE_NAME = "left" | "right";
type TARGET = CANDIDATE_NAME | null;

export interface PlayerCandidateProps {
  image?: ImageData;
  name: CANDIDATE_NAME;
  clicked: TARGET;
  clickCallback: (target: TARGET) => void;
}

export const PlayerImageCandidate = ({
  image,
  name,
  clicked,
  clickCallback,
}: PlayerCandidateProps) => {
  const { sendJsonMessage } = useMessenger();

  const handleClick = () => {
    clickCallback(name);
    sendJsonMessage({ type: MessageType.MATCHUP_VOTE, value: name });
  };

  const bg = clicked === name ? "gray" : "white";

  if (!image) return <></>;
  return (
    <Card
      style={{ cursor: "pointer" }}
      shadow="lg"
      radius="sm"
      bg={bg}
      w={150}
      onClick={handleClick}
    >
      <Group justify="center">
        <Text c="black">{image.title}</Text>
      </Group>
      <Card.Section>
        <Image id="p-image-candidate" src={image.dUri} />
      </Card.Section>
    </Card>
  );
};

export interface PlayerVoteControllerProps {
  matchup: MatchupContext;
  swapImages: SwapImage[];
  inGrace: boolean;
}

export const PlayerVoteController = ({
  matchup,
  swapImages,
  inGrace,
}: PlayerVoteControllerProps) => {
  const [clicked, setClicked] = useState<TARGET>(null);
  const [canVote, setCanVote] = useState(false);
  const { username } = useUserContext();
  const { currentEvent } = useChampdUpContext();
  const { lastJsonMessage, sendJsonMessage } = useMessenger<MessageType>();
  const [swapImgClicked, setSwapImgClicked] = useState<number | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setClicked(null);
    setCanVote(false);
    if (
      matchup.left.artists.find((p: Player) => p.username === username) !==
        undefined ||
      matchup.right.artists.find((p: Player) => p.username === username) !==
        undefined
    ) {
      setCanVote(false);
    } else {
      setCanVote(true);
    }
  }, [matchup]);

  useEffect(() => {
    setSwapImgClicked(null);
  }, [swapImages]);

  useEffect(() => {
    if (lastJsonMessage === null) return;
    if (lastJsonMessage.type === MessageType.MATCHUP_START) {
      setStarted(true);
    }
    if (
      lastJsonMessage.type === MessageType.MATCHUP ||
      lastJsonMessage.type === MessageType.MATCHUP_RESULT
    ) {
      setStarted(false);
    }
  }, [lastJsonMessage]);

  const handleSwapClick = (hash: string, idx: number) => {
    sendJsonMessage({ type: MessageType.IMAGE_SWAP, value: hash });
    setSwapImgClicked(idx);
  };

  return (
    <div id="player-vote-controller">
      {!canVote && (
        <Stack>
          <Text style={{ textShadow: "2px 2px 1px black" }}>
            {swapImages.length
              ? "Click one of your previously submitted images below to swap it out!"
              : "You can't vote on your own matchup!"}
          </Text>
          <Group>
            {swapImages.length &&
              swapImages.map((swap_img) => (
                <Card
                  style={{ cursor: "pointer", color: "black" }}
                  onClick={() =>
                    handleSwapClick(
                      swap_img.image_hash,
                      swapImages.indexOf(swap_img)
                    )
                  }
                  bg={
                    swapImgClicked === swapImages.indexOf(swap_img)
                      ? "gray"
                      : "white"
                  }
                >
                  <Card.Section>
                    <Image src={swap_img.image.dUri} w={100} />
                  </Card.Section>
                  <Title order={5}>{swap_img.image.title}</Title>
                </Card>
              ))}
          </Group>
        </Stack>
      )}
      {canVote &&
        (started ? (
          <Group justify="space-around">
            <PlayerImageCandidate
              image={matchup.left}
              name="left"
              clicked={clicked}
              clickCallback={setClicked}
            />
            <PlayerImageCandidate
              image={matchup.right}
              name="right"
              clicked={clicked}
              clickCallback={setClicked}
            />
          </Group>
        ) : (
          <Text style={{ textShadow: "2px 2px 1px black" }}>
            Waiting for matchup to start..
          </Text>
        ))}
    </div>
  );
};
