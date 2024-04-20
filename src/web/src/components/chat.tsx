import { RJsonMessage, useMessenger } from "@lib/context/ws";
import {
  ActionIcon,
  Affix,
  Avatar,
  AvatarGroup,
  Checkbox,
  Drawer,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { getHotkeyHandler, useDisclosure, useHotkeys } from "@mantine/hooks";
import { IconBrandTelegram, IconMessageCircle } from "@tabler/icons-react";
import "@/css/chat.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageType } from "@lib/champdup";
import { Player } from "@lib/player";
import { useUserContext } from "@lib/context/user";
import { usePlayerPrefs } from "@lib/context/prefs";
import { useGameContext } from "@lib/context/game";
import { isMobile } from "@utils/device";

const AVATAR_SIZE_DESKTOP = "lg";
const AVATAR_SIZE_MOBILE = "md";

export const ChatDrawer = () => {
  const viewport = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [msg, setMsg] = useState("");
  const [msgs, setMsgs] = useState<JSX.Element[]>([]);
  const { lastJsonMessage, sendJsonMessage } = useMessenger<MessageType>();
  const { username } = useUserContext();
  const [shouldNotify, setShouldNotify] = useState(false);
  const { showPolls, setShowPolls } = usePlayerPrefs();
  const { players } = useGameContext();
  const im = isMobile();

  const AVATAR_SIZE = !im ? AVATAR_SIZE_MOBILE : AVATAR_SIZE_DESKTOP;

  const switchDrawer = () => {
    if (!opened) {
      setShouldNotify(false);
      open();
    } else {
      close();
    }
  };

  useHotkeys([
    [
      "tab",
      () => {
        switchDrawer();
      },
    ],
  ]);

  const createServerText = (suffix: string) => {
    return (
      <Text color="white">
        {"[SERVER]"}: {suffix}
      </Text>
    );
  };

  const createPMText = (sender: string, receiver: string, msg: string) => {
    const to = `To ${receiver}`;
    const from = `From ${sender}`;
    const prefix = sender === username ? to : from;

    return (
      <Text color="red">
        {`[${prefix}]`}: <span style={{ color: "white" }}>{msg}</span>
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
    if (lastJsonMessage.type === MessageType.PM) {
      const sender = lastJsonMessage.value.from;
      const receiver = lastJsonMessage.value.to;
      setMsgs([
        ...msgs,
        createPMText(sender, receiver, lastJsonMessage.value.msg),
      ]);
      setShouldNotify(!opened && sender !== username);
    }
    if (lastJsonMessage.type === MessageType.CONNECT) {
      setMsgs([
        ...msgs,
        createServerText(
          `${lastJsonMessage.value.target.username} has connected!`
        ),
      ]);
    }
    if (lastJsonMessage.type == MessageType.DISCONNECT) {
      setMsgs([
        ...msgs,
        createServerText(
          `${lastJsonMessage.value.target.username} has disconnected!`
        ),
      ]);
    }
  }, [lastJsonMessage]);

  const resolveMsg = (m: RJsonMessage<MessageType>) => {
    if (m.author === 0) return createServerText(m.value);
    return (
      <Text style={{ color: m.author.color }}>
        {m.author.username}: <span style={{ color: "#ffffff" }}>{m.value}</span>
      </Text>
    );
  };

  const _sendMessage = useCallback(() => {
    let type = MessageType.CHAT;
    if (msg.startsWith("/pm ")) {
      type = MessageType.PM;
    }
    sendJsonMessage({ type, value: msg });
  }, [msg]);

  const handleSendMessage = () => {
    _sendMessage();
    setMsg("");
  };

  const scrollToBottom = () => {
    if (viewport.current === null) return;
    viewport.current!.scrollTo({
      top: viewport.current!.scrollHeight,
      behavior: "smooth",
    });
  };

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
      <Drawer
        id="chat-drawer"
        position="right"
        opened={opened}
        onClose={switchDrawer}
        title="Chat"
        zIndex={900}
        withinPortal={false}
      >
        <div id="chat-form-container">
          <Stack h="100%" align="stretch" justify="space-between">
            <ScrollArea
              id="chat-scroll"
              type="scroll"
              bg="#1a1a1a"
              p={10}
              offsetScrollbars
              style={{ height: "75vh", wordBreak: "break-word" }}
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
              <Stack>
                <Group preventGrowOverflow={false} grow>
                  <TextInput
                    ref={inputRef}
                    id="chat-text-input"
                    placeholder="Chat"
                    value={msg}
                    onChange={(e) => setMsg(e.currentTarget.value)}
                    onKeyDown={getHotkeyHandler([["Enter", handleSendMessage]])}
                  />
                  <ActionIcon color="green" onClick={handleSendMessage}>
                    <IconBrandTelegram />
                  </ActionIcon>
                </Group>
                {players.length > 0 && (
                  <AvatarGroup>
                    {players.map((p) => {
                      if (players.indexOf(p) > 4) return <></>;
                      return (
                        <Tooltip label={p.username} openDelay={250}>
                          <Avatar
                            size={AVATAR_SIZE}
                            style={{
                              cursor: "pointer",
                              backgroundColor: p.color,
                            }}
                            src={
                              p.avatar_data_url
                                ? p.avatar_data_url
                                : "/imgs/crackbox-logo-2.png"
                            }
                            onClick={() => {
                              setMsg(`/pm ${p.username} `);
                              inputRef.current!.focus();
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                    {players.length > 10 && (
                      <Avatar size={AVATAR_SIZE}>+{players.length - 10}</Avatar>
                    )}
                  </AvatarGroup>
                )}
                <Checkbox
                  label="Show polls"
                  checked={showPolls}
                  onChange={(e) => setShowPolls(e.currentTarget.checked)}
                />
              </Stack>
            </div>
          </Stack>
        </div>
      </Drawer>
    </>
  );
};
