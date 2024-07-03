import {
  ChangeEvent,
  FC,
  TouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DrawPathOptions,
  drawPaths,
  PathData,
  drawDataURIOnCanvas,
} from "@utils/draw";
import {
  downloadJson,
  downloadPng,
  getDataURL,
  getPosition,
} from "@components/sketch.utils";
import { Canvas } from "@components/Canvas";
import {
  ActionIcon,
  Avatar,
  AvatarGroup,
  Box,
  Button,
  Card,
  Group,
  Image,
  Modal,
  Popover,
  Slider,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconArrowBackUp,
  IconBrush,
  IconCheck,
  IconPalette,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { HexAlphaColorPicker } from "react-colorful";
import { ImageData } from "@lib/champdup";
import { useDisclosure } from "@mantine/hooks";
import { useMessenger } from "@lib/context/ws";
import { showNotification } from "@mantine/notifications";
import { NotifyType, useChampdUpContext } from "@lib/context/champdup";
import { useTimer } from "react-timer-hook";
import reminder0 from "/audio/reminder0.m4a";
import reminder1 from "/audio/reminder1.m4a";
import reminder2 from "/audio/reminder2.m4a";
import { getSounds } from "@utils/sound";
import { randomIntFromInterval } from "@utils/rand";
import { Player } from "@lib/player";

type HexColor = React.CSSProperties["color"];
type Change = ChangeEvent<HTMLInputElement>;
type PathStream = PathData[] | string | null;
export type DrawAction = "DRAW" | "UNDO" | "CLEAR";

const VOLUME = 0.1;

interface SPCMProps {
  opened: boolean;
  open: () => void;
  close: () => void;
  imgData: ImageData;
}

const SketchPadCounterModal = ({ opened, open, close, imgData }: SPCMProps) => {
  return (
    <Modal opened={opened} onClose={close}>
      <Stack align="center">
        <Title>Counter this champion!</Title>
        <Card bg="white">
          <Card.Section>
            <Image src={imgData.dUri} w={150} />
          </Card.Section>
        </Card>
      </Stack>
      <Group justify="center">
        <Title order={4}>{imgData.title}</Title>
      </Group>
    </Modal>
  );
};

interface SPRMProps {
  opened: boolean;
  close: () => void;
  submit: () => void;
  setTitle: (t: string) => void;
}
const SketchPadReminderModal = (props: SPRMProps) => {
  const reminderSounds = getSounds([reminder0, reminder1, reminder2], VOLUME);

  useEffect(() => {
    if (props.opened) {
      reminderSounds[randomIntFromInterval(0, reminderSounds.length - 1)][0]();
    }
  }, [props.opened]);

  return (
    <Modal opened={props.opened} onClose={props.close}>
      <Stack>
        <Title>Submit your Champion!</Title>
        <Group justify="center" align="center">
          <TextInput
            placeholder="Enter your title here"
            onChange={(e) => props.setTitle(e.currentTarget.value)}
          />
          <Button onClick={props.submit} fullWidth color="green">
            Submit
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

interface SketchPadControlOptions {
  undo?: boolean;
  clear?: boolean;
  exportToPng?: boolean;
  exportJson?: boolean;
}

interface CounterData {
  counter: ImageData;
}

interface DrawData {
  prompt: string;
}

type SketchPadGameData = DrawData | CounterData;

export interface SketchPadProps {
  id?: string;
  size?: number;
  styles?: React.HTMLAttributes<HTMLCanvasElement>["style"];
  scale?: [number, number];
  controls?: SketchPadControlOptions;
  gameData?: SketchPadGameData | null;
  teammates?: Player[];
}

const defaults: Required<SketchPadProps> = {
  size: 375,
  styles: { backgroundColor: "white", boxShadow: "0px 0px 10px 2px black" },
  scale: [1, 1],
  controls: { undo: true, exportJson: true, exportToPng: true, clear: true },
  id: "",
  gameData: null,
  teammates: [],
};

export enum MessageType {
  STATE = "STATE",
  IMAGE = "IMAGE",
  NOTIFY = "NOTIFY",
  CLEAR = "CLEAR",
  PATH = "PATH",
}

export const SketchPad: FC<SketchPadProps & DrawPathOptions> = (props) => {
  const {
    id,
    size,
    styles,
    scale,
    controls,
    color,
    lineCap,
    lineJoin,
    lineWidth,
    gameData,
    teammates,
  } = {
    ...defaults,
    ...props,
    controls: {
      ...defaults.controls,
      ...props.controls,
    },
    styles: {
      ...defaults.styles,
      ...props.styles,
    },
  };
  const drawOpts = useMemo(
    () => ({ color, lineCap, lineJoin, lineWidth }),
    [color, lineCap, lineJoin, lineWidth]
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paths, setPaths] = useState<PathData[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [undoListener, setUndoListener] = useState(0);
  const [brushColor, setBrushColor] = useState<HexColor>("#000000");
  const [brushWidth, setBrushWidth] = useState(10);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [counter, setCounter] = useState<ImageData | null>(null);
  const [opened, { open, close }] = useDisclosure(true);
  const [bgDataURI, setBgDataURI] = useState<string | null>(null);
  const { lastJsonMessage, sendJsonMessage } = useMessenger<MessageType>();
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showReminder, { open: reminderOpen, close: reminderClose }] =
    useDisclosure(false);
  const { currentEvent, currentEventData } = useChampdUpContext();
  const [reminderExpires, setReminderExpires] = useState<Date | null>(null);
  const [currentPath, setCurrentPath] = useState<PathData | null>(null);
  const [multiplayerEnabled, setMPEnabled] = useState(false);

  useEffect(() => {
    if (!gameData) return;
    setPaths([]);
    setTitle("");
    setHasSubmitted(false);
    reminderClose();
    const drawData = gameData as DrawData;
    const counterData = gameData as CounterData;
    if (drawData.prompt) {
      setPrompt(drawData.prompt);
      setCounter(null);
    }
    if (counterData.counter) {
      setCounter(counterData.counter);
      setPrompt("");
    }
    if (currentEvent && currentEvent.ends) {
      const d0 = new Date();
      const d1 = new Date(currentEvent.ends);
      const duration = d1.getTime() - d0.getTime();
      d0.setTime(d0.getTime() + duration * 0.9);
      setReminderExpires(d0);
    }
  }, [gameData]);

  const ReminderTimerComponent = ({
    expiryTimestamp,
  }: {
    expiryTimestamp: Date | null;
  }) => {
    if (!expiryTimestamp) return <></>;

    useTimer({
      expiryTimestamp,
      onExpire: () => {
        if (!hasSubmitted) {
          reminderOpen();
        }
      },
    });

    return <></>;
  };

  const getContext = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) throw new Error("No context found");
    return ctx;
  }, [canvasRef]);

  useEffect(() => {
    if (currentEvent === null) return;
    if (currentEvent.name.startsWith("B")) {
      setMPEnabled(true);
    } else {
      setMPEnabled(false);
    }
  }, [currentEvent]);

  const draw = useCallback(() => {
    const ctx = getContext();
    ctx.clearRect(0, 0, size, size);
    drawPaths(ctx, paths);
    if (currentPath) {
      drawPaths(ctx, [currentPath]);
    }
  }, [drawOpts, getContext, paths, size, currentPath]);

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = getContext();
      ctx.scale(scale[0], scale[1]);
    }
  }, [getContext, scale]);

  useEffect(() => {
    draw();
  }, [paths, draw, undoListener]);

  const handleStartPath = (position: [number, number]) => {
    setCurrentPath({
      path: [position],
      canvasSize: size,
      opts: {
        color: brushColor,
        lineCap: "round",
        lineJoin: "round",
        lineWidth: brushWidth,
      },
      timestamp: new Date().toISOString(),
    });
    setIsDrawing(true);
  };

  const handleDrawPath = (position: [number, number]) => {
    setCurrentPath((target) => {
      if (!target) return null;
      target.path.push(position);
      return target;
    });
    draw();
  };

  const handleMouseDown = (
    evt: React.MouseEvent<HTMLCanvasElement, MouseEvent>
  ) => {
    const position = getPosition(evt, canvasRef.current!);
    handleStartPath(position);
  };

  const handleTouchStart = (evt: TouchEvent<HTMLCanvasElement>) => {
    const position = getPosition(evt, canvasRef.current!);
    handleStartPath(position);
  };

  const handleMouseMove = (
    evt: React.MouseEvent<HTMLCanvasElement, MouseEvent>
  ) => {
    if (isDrawing) {
      const position = getPosition(evt, canvasRef.current!);
      handleDrawPath(position);
    }
  };

  const handleTouchMove = (evt: TouchEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      const position = getPosition(evt, canvasRef.current!);
      handleDrawPath(position);
    }
  };

  const handleDrawEnd = () => {
    setIsDrawing(false);
    if (currentPath) {
      const copy = currentPath;
      copy.timestamp = new Date().toISOString();
      setPaths([...paths, copy]);
      sendJsonMessage({
        type: MessageType.PATH,
        value: {
          path: currentPath,
          dUri: canvasRef.current ? getDataURL(canvasRef.current) : "",
        }
      })
    }
    setCurrentPath(null);
  };

  const handleUndo = () => {
    setPaths((currentPaths) => {
      currentPaths.pop();
      return currentPaths;
    });
    setUndoListener(undoListener + 1);
  };

  const handleClear = () => {
    if (!canvasRef.current) return;
    setPaths(() => []);
    sendJsonMessage({
      type: MessageType.CLEAR,
      value: null,
    });
  };

  const handleSubmit = () => {
    if (!canvasRef.current) return;
    sendJsonMessage({
      type: MessageType.IMAGE,
      value: { dUri: getDataURL(canvasRef.current), title },
    });
    setHasSubmitted(true);
    reminderClose();
  };

  useEffect(() => {
    if (window) {
      window.addEventListener("mouseup", handleDrawEnd);
      window.addEventListener("touchend", handleDrawEnd);
    }
    return () => {
      if (window) {
        window.removeEventListener("mouseup", handleDrawEnd);
        window.removeEventListener("touchend", handleDrawEnd);
      }
    };
  }, []);

  useEffect(() => {
    if (lastJsonMessage === null) return;
    if (lastJsonMessage.type === MessageType.NOTIFY) {
      showNotification({
        title: lastJsonMessage.value.type,
        message: lastJsonMessage.value.message,
        color: lastJsonMessage.value.type == NotifyType.FAIL ? "red" : "green",
        icon:
          lastJsonMessage.value.type == NotifyType.FAIL ? (
            <IconX />
          ) : (
            <IconCheck />
          ),
      });
    }
    if (lastJsonMessage.type === MessageType.CLEAR) {
      setPaths([]);
    }
    if (lastJsonMessage.type === MessageType.PATH) {
      setPaths([...paths, lastJsonMessage.value.path]);
    }
  }, [lastJsonMessage]);

  useEffect(() => {
    if (currentEventData === null) return;
    if (currentEventData.paths_chunk) {
      setPaths(currentEventData.paths_chunk);
    }
  }, [currentEventData])

  return (
    <div id="sketch-pad-wrapper" style={{ width: size }}>
      <SketchPadReminderModal
        opened={showReminder && !hasSubmitted}
        close={reminderClose}
        submit={handleSubmit}
        setTitle={setTitle}
      />
      <ReminderTimerComponent expiryTimestamp={reminderExpires} />
      <Stack id="sketch-pad-controls" align="center">
        {counter && (
          <>
            <Card w={100} bg="white">
              <Card.Section>
                <Image src={counter.dUri} onClick={open} />
              </Card.Section>
            </Card>
            <SketchPadCounterModal
              opened={opened}
              close={close}
              open={open}
              imgData={counter}
            />
          </>
        )}
        {prompt && (
          <Title style={{ textAlign: "center" }}>
            Draw the Champion of {prompt}
          </Title>
        )}
        {teammates && (
          <AvatarGroup>
            {teammates.map((plr) => (
              <Avatar
                size="md"
                src={
                  plr.avatar_data_url
                    ? plr.avatar_data_url
                    : "/imgs/crackbox-logo-2.png"
                }
                style={{ backgroundColor: plr.color }}
              />
            ))}
          </AvatarGroup>
        )}
        <Canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleDrawEnd}
          onMouseOut={handleDrawEnd}
          onTouchMove={handleTouchMove}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleDrawEnd}
          size={size}
          styles={styles}
        />
        <Group justify="center" gap="md">
          <Popover withArrow shadow="md">
            <Popover.Target>
              <ActionIcon>
                <IconPalette />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <HexAlphaColorPicker
                color={brushColor}
                onChange={setBrushColor}
              />
            </Popover.Dropdown>
          </Popover>
          <Popover withArrow shadow="md">
            <Popover.Target>
              <ActionIcon>
                <IconBrush />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <Box w={100}>
                <Slider
                  step={1}
                  value={brushWidth}
                  onChange={setBrushWidth}
                  max={50}
                  min={1}
                />
              </Box>
            </Popover.Dropdown>
          </Popover>
          {!multiplayerEnabled && (
            <ActionIcon onClick={handleUndo}>
              <IconArrowBackUp />
            </ActionIcon>
          )}
          <ActionIcon color="red" onClick={handleClear}>
            <IconX />
          </ActionIcon>
        </Group>
        <TextInput
          placeholder="Champion Title"
          label={`Title (${title.length}/64)`}
          error={title.length > 64}
          value={title}
          onChange={(e: Change) => setTitle(e.currentTarget.value)}
        />
        <Button fullWidth onClick={handleSubmit} leftSection={<IconUpload />}>
          Submit
        </Button>
      </Stack>
    </div>
  );
};
