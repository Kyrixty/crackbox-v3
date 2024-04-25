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
import { DrawPathOptions, drawPaths, PathData, drawDataURIOnCanvas } from "@utils/draw";
import {
  downloadJson,
  downloadPng,
  getDataURL,
  getPosition,
} from "@components/sketch.utils";
import { Canvas } from "@components/Canvas";
import {
  ActionIcon,
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
  IconPalette,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { HexAlphaColorPicker } from "react-colorful";
import { ImageData } from "@lib/champdup";
import { useDisclosure } from "@mantine/hooks";
import { useMessenger } from "@lib/context/ws";

type HexColor = React.CSSProperties["color"];
type Change = ChangeEvent<HTMLInputElement>;
type PathStream = PathData[] | string | null;
export type DrawAction = "DRAW" | "UNDO" | "CLEAR";

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
            <Image src={imgData.img_data_url} w={150} />
          </Card.Section>
        </Card>
      </Stack>
      <Group justify="center">
        <Title>{imgData.title}</Title>
      </Group>
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
  pathStream?: PathStream;
  submitPathData:
    | ((
        actionType: DrawAction,
        dUrl: string,
        title: string,
        pathData: PathData[]
      ) => void)
    | null;
  gameData?: SketchPadGameData | null;
}

const defaults: Required<SketchPadProps> = {
  size: 375,
  styles: { backgroundColor: "white", boxShadow: "0px 0px 10px 2px black" },
  scale: [1, 1],
  controls: { undo: true, exportJson: true, exportToPng: true, clear: true },
  pathStream: null,
  submitPathData: null,
  id: "",
  gameData: null,
};

export enum MessageType {
  STATE = "STATE",
  DRAW_READY = "draw-ready",
  DRAW_CLEAR = "draw-clear",
  DRAW_UNDO = "draw-undo",
  DRAW_DATA = "draw-data",
}

export const SketchPad: FC<SketchPadProps & DrawPathOptions> = (props) => {
  const {
    id,
    size,
    styles,
    scale,
    pathStream,
    submitPathData,
    controls,
    color,
    lineCap,
    lineJoin,
    lineWidth,
    gameData,
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

  useEffect(() => {
    handleQuietClear();
    sendJsonMessage({ type: MessageType.DRAW_READY, value: null });
    draw();
    if (!gameData) return;
    const drawData = gameData as DrawData;
    const counterData = gameData as CounterData;
    if (drawData.prompt) {
      setPrompt(drawData.prompt);
    }
    if (counterData.counter) {
      setCounter(counterData.counter);
    }

  }, []);

  const getContext = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) throw new Error("No context found");
    return ctx;
  }, [canvasRef]);

  const draw = useCallback(() => {
    const ctx = getContext();
    //ctx.clearRect(0, 0, size, size);
    if (bgDataURI !== null) {
      drawDataURIOnCanvas(bgDataURI, ctx);
    }
    drawPaths(ctx, paths);
  }, [drawOpts, getContext, paths, size, bgDataURI]);

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = getContext();
      ctx.scale(scale[0], scale[1]);
    }
  }, [getContext, scale]);

  useEffect(() => {
    draw();
  }, [paths, draw]);

  useEffect(() => {
    if (bgDataURI !== null) {
      draw();
    }
  }, [bgDataURI])

  const handleStartPath = (position: [number, number]) => {
    setPaths((existingPaths) => [
      ...existingPaths,
      {
        path: [position],
        canvasSize: size,
        opts: {
          color: brushColor,
          lineCap: "round",
          lineJoin: "round",
          lineWidth: brushWidth,
        },
      },
    ]);
    setIsDrawing(true);
  };

  const handleDrawPath = (position: [number, number]) => {
    setPaths((currentPaths) => {
      if (currentPaths.length === 0) {
        currentPaths.push({canvasSize: size, opts: drawOpts, path: []});
      }
      const lastPathIdx = currentPaths.length - 1;
      const lastPath = currentPaths[lastPathIdx].path;
      lastPath.push(position);
      currentPaths[lastPathIdx].path = lastPath;
      return currentPaths;
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
    handleSubmit();
  };

  const handleClear = () => {
    handleQuietClear();
    sendJsonMessage({ type: MessageType.DRAW_CLEAR, value: null });
  };

  const handleQuietClear = () => {
    setPaths(() => []);
    setBgDataURI(null);
    const ctx = getContext();
    ctx.clearRect(0, 0, size, size);
  };

  const handleSubmit = () => {
    if (!canvasRef.current) return;
    sendJsonMessage({
      type: MessageType.DRAW_DATA,
      value: {
        dUri: getDataURL(canvasRef.current),
        title,
        path: paths[paths.length - 1],
      },
    });
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
    if (lastJsonMessage.type === MessageType.DRAW_CLEAR) {
      handleQuietClear();
    }
    if (lastJsonMessage.type === MessageType.DRAW_DATA) {
      const d = lastJsonMessage.value;
      setBgDataURI(d.dUri);
      draw();
    }

    if (lastJsonMessage.type === MessageType.STATE) {
      const dUri: string | null = lastJsonMessage.value.cduri;
      if (dUri === null) {
        handleQuietClear();
      } else {
        setBgDataURI(dUri);
        draw();
      }
    }
  }, [lastJsonMessage]);

  return (
    <div id="sketch-pad-wrapper" style={{ width: size }}>
      <Stack id="sketch-pad-controls">
        {prompt && (
          <Title style={{ textAlign: "center" }}>
            The the Champion of {prompt}
          </Title>
        )}
        {counter && (
          <SketchPadCounterModal
            opened={opened}
            close={close}
            open={open}
            imgData={counter}
          />
        )}
        <Canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleDrawEnd}
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
          <ActionIcon>
            <IconArrowBackUp />
          </ActionIcon>
          <ActionIcon color="red" onClick={handleClear}>
            <IconX />
          </ActionIcon>
        </Group>
        <TextInput
          placeholder="Champion Title"
          onChange={(e: Change) => setTitle(e.currentTarget.value)}
        />
        <Button fullWidth onClick={handleSubmit} leftSection={<IconUpload />}>
          Submit
        </Button>
      </Stack>
    </div>
  );
};
