import { RJsonMessage, useMessenger } from "@lib/context/ws";
import {
  ActionIcon,
  Drawer,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { getHotkeyHandler, useDisclosure, useHotkeys } from "@mantine/hooks";
import { IconBrandTelegram, IconMessageCircle } from "@tabler/icons-react";
import "@/css/chat.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageType } from "./champdup";
import { Player } from "@lib/player";
import { useUserContext } from "@lib/context/user";

export const ChatDrawer = () => {
  const viewport = useRef<HTMLDivElement>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [msg, setMsg] = useState("");
  const [msgs, setMsgs] = useState<JSX.Element[]>([]);
  const { lastJsonMessage, sendJsonMessage } = useMessenger<MessageType>();
  const { username } = useUserContext();
  const [shouldNotify, setShouldNotify] = useState(false);

  const switchDrawer = () => {
    if (!opened) {
      setShouldNotify(false);
      open();
    } else {
      close();
    }
  }

  useHotkeys([
    ["tab", () => {switchDrawer()}],
  ])

  const createServerText = (suffix: string) => {
    return (
      <Text color="white">
        {"[SERVER]"}: {suffix}
      </Text>
    );
  };

  useEffect(() => {
    if (lastJsonMessage === null) return;
    if (lastJsonMessage.type === MessageType.CHAT) {
      setMsgs([...msgs, resolveMsg(lastJsonMessage)]);
      if (lastJsonMessage.author !== 0) {
        const p = lastJsonMessage.author;
        setShouldNotify(!opened && p.username !== username);
      }
      scrollToBottom();
    }
    if (lastJsonMessage.type === MessageType.CONNECT) {
      setMsgs([
        ...msgs,
        createServerText(`${lastJsonMessage.value.target.username} has connected!`),
      ]);
    }
    if (lastJsonMessage.type == MessageType.DISCONNECT) {
      setMsgs([
        ...msgs,
        createServerText(`${lastJsonMessage.value.target.username} has disconnected!`),
      ]);
    }
  }, [lastJsonMessage]);

  const resolveMsg = (m: RJsonMessage<MessageType>) => {
    if (m.author === 0)
      return createServerText(m.value);
    return (
      <Text style={{color: m.author.color}}>
        {m.author.username}: <span style={{color: "#ffffff"}}>{m.value}</span>
      </Text>
    );
  };


  const _sendMessage = useCallback(
    () =>
      sendJsonMessage({
        type: MessageType.CHAT,
        value: msg,
      }),
    [msg]
  );

  const handleSendMessage = () => {
    _sendMessage();
    setMsg("");
  }

  const scrollToBottom = () => {
    if (viewport.current === null) return;
    viewport.current!.scrollTo({
      top: viewport.current!.scrollHeight,
      behavior: "smooth",
    });
  }
  
  return (
    <>
      <div id="chat-toggle">
        {!opened && (
          <div id="chat-toggle" onClick={switchDrawer}>
            <IconMessageCircle size={24} />
            {shouldNotify && <div id="chat-notification" />}
          </div>
        )}
      </div>
      <Drawer position="right" opened={opened} onClose={switchDrawer} title="Chat">
        <div id="chat-form-container">
          <Stack h="100%" align="stretch" justify="space-between">
            <ScrollArea
              id="chat-scroll"
              type="scroll"
              bg="#1a1a1a"
              p={10}
              offsetScrollbars
              style={{ height: "80vh", wordBreak: "break-word" }}
              viewportRef={viewport}
            >
              <>
                <Text>
                  <i>Welcome to the chat!</i>
                </Text>
                {msgs.map((m) => m)}
              </>
            </ScrollArea>
            <div id="chat-input-container">
              <Group preventGrowOverflow={false} grow>
                <TextInput
                  id="chat-text-input"
                  placeholder="Chat"
                  value={msg}
                  onChange={(e) => setMsg(e.currentTarget.value)}
                  onKeyDown={getHotkeyHandler([
                    ["Enter", handleSendMessage]
                  ])}
                />
                <ActionIcon color="green" onClick={handleSendMessage}>
                  <IconBrandTelegram />
                </ActionIcon>
              </Group>
            </div>
          </Stack>
        </div>
      </Drawer>
    </>
  );
};
