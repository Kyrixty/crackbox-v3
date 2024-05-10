import { ImageData, MatchupContext } from "@lib/champdup";
import { useMessenger } from "@lib/context/ws";
import { Card, Group, Image, Stack, Text } from "@mantine/core";
import { MessageType } from "@lib/champdup";
import { useEffect, useState } from "react";

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
  }, [votes])

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

  useEffect(() => setClicked(null), [matchup]);

  return (
    <div id="player-vote-controller">
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
    </div>
  );
};
