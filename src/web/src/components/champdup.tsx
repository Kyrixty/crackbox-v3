import { useGameContext } from "@lib/context/game";
import { useUserContext } from "@lib/context/user";
import { Player } from "@lib/player";
import { Card, Group, Image, Text, Title } from "@mantine/core";
import { isMobile } from "@utils/ismobile";
import { MessageType } from "@lib/champdup";
import { useEffect } from "react";
import "@/css/champdup.css";
import { ChatDrawer } from "./chat";
import { Poll } from "./poll";

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
        <Image src={imgSrc} width={dm} height={dm} />
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
        <Text style={{textShadow: "1px 1px 1px black"}}>
          <b><i>{p.bio}</i></b>
        </Text>
      </Card.Section>
    </Card>
  );
};

const Lobby = () => {
  const { players } = useGameContext();

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
      <Group justify="center">
        {players.map((p) => (
          <PlayerCard p={p} />
        ))}
      </Group>
    </div>
  );
};

export const ChampdUp = () => {
  const { username, isHost, token, ticket } = useUserContext();
  const { gameId } = useGameContext();

  useEffect(() => {
    console.log("ON LOAD");
    console.log({ username, isHost, token, ticket, gameId });
  }, []);


  return (
    <div id="champdup-root">
      <Lobby />
      <ChatDrawer />
      <Poll />
    </div>
  )

}