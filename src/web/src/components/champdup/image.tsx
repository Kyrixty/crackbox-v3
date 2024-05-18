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
}

export const PlayerVoteController = ({
  matchup,
  swapImages,
}: PlayerVoteControllerProps) => {
  const [clicked, setClicked] = useState<TARGET>(null);
  const [canVote, setCanVote] = useState(false);
  const { username } = useUserContext();
  const { currentEvent } = useChampdUpContext();
  const { sendJsonMessage } = useMessenger<MessageType>();

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
    console.log(swapImages);
  }, [swapImages])

  const handleSwapClick = (hash: string) => {
    sendJsonMessage({ type: MessageType.IMAGE_SWAP, value: hash });
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
                  onClick={() => handleSwapClick(swap_img.image_hash)}
                  bg="white"
                >
                  <Card.Section>
                    <Image src={swap_img.image.dUri} w={100} />
                  </Card.Section>
                  <Title order={4}>{swap_img.image.title}</Title>
                </Card>
              ))}
          </Group>
        </Stack>
      )}
      {canVote && (
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
      )}
    </div>
  );
};
