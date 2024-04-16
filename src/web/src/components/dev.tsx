import "@/css/dev.css";
import { useGameContext } from "@lib/context/game";
import { useUserContext } from "@lib/context/user";
import { useMessenger, READYSTATE_MAP } from "@lib/context/ws";
import { ScrollArea, Stack, Text } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useState } from "react";

export const DevConsole = () => {
  const { gameId, players } = useGameContext();
  const { lastJsonMessage, readyState } = useMessenger();
  const { token, ticket } = useUserContext();
  const [isVisible, setIsVisible] = useState(false);

  useHotkeys([["`", () => setIsVisible(!isVisible)]]);

  return (
    <>
      {isVisible && (
        <div id="dev-console">
          <ScrollArea h={400} w={500} style={{ wordBreak: "break-all" }}>
            <Stack gap="md">
              <Text>Game ID: {gameId}</Text>
              <Text>Players: {JSON.stringify(players)}</Text>
              <Text>Last Message: {JSON.stringify(lastJsonMessage)}</Text>
              <Text>Ready State: {READYSTATE_MAP[readyState]}</Text>
              <Text>Token: {token}</Text>
              <Text>Ticket: {ticket}</Text>
            </Stack>
          </ScrollArea>
        </div>
      )}
    </>
  );
};
