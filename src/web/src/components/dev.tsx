import "@/css/dev.css";
import { useGameContext } from "@lib/context/game";
import { useUserContext } from "@lib/context/user";
import { useMessenger, READYSTATE_MAP } from "@lib/context/ws";
import { ScrollArea, Stack, Text } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useState } from "react";
import ReactJson from "react-json-view";

interface DCProps {
  get_game_state?: () => Object;
}

export const DevConsole = (props: DCProps) => {
  const { gameId, players, hostConnected, status } = useGameContext();
  const { lastJsonMessage, readyState } = useMessenger();
  const { token, ticket } = useUserContext();
  const [isVisible, setIsVisible] = useState(false);

  const gameState = props.get_game_state ? props.get_game_state() : {hostConnected, players, status}

  useHotkeys([["`", () => setIsVisible(!isVisible)]]);

  return (
    <>
      {isVisible && (
        <div id="dev-console">
          <ScrollArea h={400} w={500} style={{ wordBreak: "break-all" }}>
            <Stack gap="md">
              <ReactJson
                src={gameState}
                theme="bespin"
                enableClipboard
                collapsed={2}
              />
              {/* <Text>Game ID: {gameId}</Text>
              <Text>Players: {JSON.stringify(players)}</Text>
              <Text>
                Last Message Received: {JSON.stringify(lastJsonMessage)}
              </Text>
              <Text>Ready State: {READYSTATE_MAP[readyState]}</Text>
              <Text>
                Game State: {JSON.stringify({ hostConnected, players, status })}
              </Text>
              <Text>Token: {token}</Text>
              <Text>Ticket: {ticket}</Text> */}
            </Stack>
          </ScrollArea>
        </div>
      )}
    </>
  );
};
