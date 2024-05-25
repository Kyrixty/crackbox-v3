import {
  EventNames,
  ImageData,
  MatchupContext,
  SwapImage,
} from "@lib/champdup";
import { useMessenger } from "@lib/context/ws";
import {
  Card,
  Group,
  Image,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { MessageType } from "@lib/champdup";
import { useEffect, useState } from "react";
import { useUserContext } from "@lib/context/user";
import { Player } from "@lib/player";
import { useChampdUpContext } from "@lib/context/champdup";

export interface ImageCandidateProps {
  image?: ImageData;
  votes: string[];
  totalVotes: number;
}

export interface HostMatchupControllerProps {
  left: ImageCandidateProps;
  right: ImageCandidateProps;
}

export const HostMatchupController = ({
  left,
  right,
}: HostMatchupControllerProps) => {
  return (
    <Group justify="space-around">
      <SimpleGrid cols={2}>
        <HostImageCandidate
          image={left.image}
          votes={left.votes}
          totalVotes={left.totalVotes}
        />
        <HostImageCandidate
          image={right.image}
          votes={right.votes}
          totalVotes={right.totalVotes}
        />
      </SimpleGrid>
    </Group>
  );
};

export const HostImageCandidate = ({
  image,
  votes,
  totalVotes,
}: ImageCandidateProps) => {
  if (!image) return <></>;

  useEffect(() => {
    console.log(votes);
  }, [votes]);

  return (
    <Card shadow="lg" radius="sm" bg="white" w={300}>
      <Group justify="center">
        <Stack>
          <Text>
            {votes.length} / {totalVotes}
          </Text>
          <Text>{image.title}</Text>
        </Stack>
      </Group>
      <Card.Section>
        <Image src={image.dUri} />
      </Card.Section>
    </Card>
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
        <Text>{image.title}</Text>
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
          <SimpleGrid cols={2}>
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
          </SimpleGrid>
        ) : (
          <Text style={{ textShadow: "2px 2px 1px black" }}>
            Waiting for matchup to start..
          </Text>
        ))}
    </div>
  );
};
