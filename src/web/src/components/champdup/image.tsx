import {
  EventNames,
  ImageData,
  MatchupContext,
  SwapImage,
} from "@lib/champdup";
import { useMessenger } from "@lib/context/ws";
import {
  Box,
  Card,
  Group,
  Image,
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

import godlike from "/audio/godlike.mp3";
import holy from "/audio/holy.mp3";
import therapy from "/audio/therapy.mp3";
import fire from "/audio/fire.wav";

import { getSounds } from "@utils/sound";

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

  const handleNewMatchup = (leftImage: ImageData, rightImage: ImageData) => {
    setLeftImg(leftImage);
    setLeftMounted(true);
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
    </Box>
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
        firePlay();
        sounds[randomIntFromInterval(0, sounds.length - 1)][0]();
      }
    }
    setFireCache(onFire);
  }, [votes]);

  const sounds = getSounds([godlike, holy, therapy], 0.2);
  const [firePlay] = useSound(fire, {volume: 0.3});

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
      <Image style={style} src={image.dUri} w={300} />
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
  if (!image) return <></>;
  const { sendJsonMessage } = useMessenger();

  const handleClick = () => {
    clickCallback(name);
    sendJsonMessage({ type: MessageType.MATCHUP_VOTE, value: name });
  };

  const bg = clicked === name ? "gray" : "white";

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
  const { sendJsonMessage } = useMessenger<MessageType>();
  const [swapImgClicked, setSwapImgClicked] = useState<number | null>(null);

  const started = !inGrace || matchup.started;

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
