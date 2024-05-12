import { ImageData, MatchupContext } from "@lib/champdup";
import { useMessenger } from "@lib/context/ws";
import { Card, Group, Image, SimpleGrid, Stack, Text } from "@mantine/core";
import { MessageType } from "@lib/champdup";
import { useEffect, useState } from "react";
import { useUserContext } from "@lib/context/user";
import { Player } from "@lib/player";

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
}

export const PlayerVoteController = ({
  matchup,
}: PlayerVoteControllerProps) => {
  const [clicked, setClicked] = useState<TARGET>(null);
  const [canVote, setCanVote] = useState(false);
  const { username } = useUserContext();

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

  return (
    <div id="player-vote-controller">
      {!canVote && (
        <Text style={{ textShadow: "2px 2px 1px black" }}>
          You can't vote on your own matchup!
        </Text>
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
