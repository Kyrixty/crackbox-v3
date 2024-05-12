import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Checkbox,
  FileButton,
  FileInput,
  Flex,
  Group,
  HoverCard,
  Image,
  Loader,
  NativeSelect,
  NumberInput,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { getAPI } from "@lib/api";
import {
  ConfigField,
  ConfigFieldType,
  FieldValueType,
} from "@lib/gamemodeconfig";
import { IconListDetails, IconUpload, IconX } from "@tabler/icons-react";
import "@/css/centered.css";
import "@/css/landing.css";
import { mapToObj } from "@utils/map";
import { useUserContext } from "@lib/context/user";
import { useGameContext } from "@lib/context/game";
import { redirect } from "@utils/redirect";
import { CrackboxLogoGrid } from "@components/crackbox";
import { isMobile } from "@utils/device";
import { randomIntFromInterval } from "@utils/rand";
import { toTitleCase } from "@utils/str";
import { showNotification } from "@mantine/notifications";
import { useMediaQuery } from "@mantine/hooks";

interface FormProps {
  switch: () => void;
}

interface CreateProps {
  gameModes: string[];
}

const minecraftTexts = [
  "Noob",
  "JShmackas if you're reading this please give me a big smooch",
  "Faggot",
  "Okay but let's get off this shit and get on roll already",
  "Buy BattleBit",
  "If you're seeing this ask jcl if he's gay",
  "More stable than OceanGate's submarine",
  "😎",
  "🍆🌋😵",
  "We sell your data for practically any price",
  "Only the finest Flipside engineering went into this",
  "We mine BTC on your PC",
  "No Hitler drawings",
  "ur gay",
  "Foozmon was here",
  "Put Foozmon in the album",
  "You got soft hands, boy",
  "You're going to love your Desjardins agent",
  "Baby dick or baby hands?",
];

const JoinForm = (props: FormProps) => {
  const { gameId, setGameId } = useGameContext();
  const { username, setUsername, setToken, setTicket, setIsHost } =
    useUserContext();
  const [avatar, _setAvatar] = useState<File | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string>("");
  const resetRef = useRef<() => void>(null);

  const setAvatar = (f: File | null) => {
    // _setAvatar(null);
    // resetRef.current?.();
    // return () =>
    _setAvatar(f);
  };

  const handleJoin = async () => {
    const api = getAPI();
    await api
      .put(`/game/join/${gameId}/${username}`, { avatar_data_url: avatarSrc })
      .then((res) => {
        if (res.status === 200) {
          setIsHost(false);
          setToken(res.data.access_token);
          setTicket(res.data.ticket);
          redirect("/game");
        }
      });
  };

  useEffect(() => {
    var reader = new FileReader();
    if (avatar === null) return;
    reader.readAsDataURL(avatar);
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarSrc(reader.result);
      }
    };

    reader.onerror = () => {
      console.log(reader.error);
      showNotification({
        title: "Error",
        icon: <IconX />,
        message:
          "Error reading file, please try again. Check console for details.",
        color: "red",
      });
    };
  }, [avatar]);

  const FileUploadForm = () => (
    <Stack justify="center" align="center">
      <HoverCard position="top">
        <FileButton
          resetRef={resetRef}
          onChange={setAvatar}
          accept="image/png,image/jpeg"
        >
          {(props) => (
            <HoverCard.Target>
              <Avatar
                radius={0}
                style={{ cursor: "pointer" }}
                imageProps={{
                  style: { backgroundSize: "cover", backgroundRepeat: "round" },
                }}
                size="lg"
                src={avatarSrc}
                {...props}
              />
            </HoverCard.Target>
          )}
        </FileButton>
        <HoverCard.Dropdown>
          <Text size="sm">
            Images only persist for the duration of the game.
          </Text>
        </HoverCard.Dropdown>
      </HoverCard>
    </Stack>
  );

  return (
    <div id="join-form-root">
      <Stack>
        <Title>Join</Title>
        <TextInput
          placeholder="Username"
          onChange={(e) => setUsername(e.currentTarget.value)}
        />
        <TextInput
          placeholder="Game ID"
          value={gameId}
          onChange={(e) => setGameId(e.currentTarget.value.toUpperCase())}
        />
        <FileUploadForm />
        <Button fullWidth color="green" onClick={handleJoin}>
          Join
        </Button>
        <Text id="switch-text" onClick={props.switch}>
          Want to create a game?
        </Text>
      </Stack>
    </div>
  );
};

const ConfigViewer = ({
  currentConfig,
  setData,
}: {
  currentConfig: ConfigField[] | undefined;
  setData: (m: Map<string, FieldValueType>) => void;
}) => {
  const [viewing, setViewing] = useState(false);
  const [data, __setData] = useState<Map<string, FieldValueType>>(new Map());

  useEffect(() => {
    __setData(new Map());
  }, [currentConfig]);

  useEffect(() => setData(data), [data]);

  const resolveField = (field: ConfigField) => {
    const _setData = (k: string, v: FieldValueType) => {
      if (typeof field.value !== "object") {
        field.value = v;
      }
      __setData((d) => new Map(d.set(k, v)));
    };

    const getFieldTitle = () => toTitleCase(field.name.replaceAll("_", " "));

    if (field.type === ConfigFieldType.BOOL) {
      return (
        <Checkbox
          label={getFieldTitle()}
          checked={field.value as boolean}
          onChange={(e) => _setData(field.name, e.currentTarget.checked)}
        />
      );
    }
    if (field.type === ConfigFieldType.NUMBER) {
      return (
        <NumberInput
          label={getFieldTitle()}
          value={field.value as number}
          onChange={(e) => _setData(field.name, e)}
        />
      );
    }
    if (field.type === ConfigFieldType.SELECT) {
      return (
        <NativeSelect
          label={getFieldTitle()}
          data={field.value as []}
          onChange={(e) => _setData(field.name, e.currentTarget.value)}
        />
      );
    }
    if (field.type === ConfigFieldType.STRING) {
      return (
        <TextInput
          placeholder={getFieldTitle()}
          label={getFieldTitle()}
          value={field.value as string}
          onChange={(e) => _setData(field.name, e.currentTarget.value)}
        />
      );
    }
  };
  return (
    <div id="config-viewer">
      {currentConfig && (
        <>
          <Group align="center">
            <IconListDetails />
            <Text onClick={() => setViewing(!viewing)} id="switch-text">
              Advanced options
            </Text>
          </Group>
          {viewing && (
            <ScrollArea h={150} offsetScrollbars p={10}>
              <Stack>{currentConfig.map((field) => resolveField(field))}</Stack>
            </ScrollArea>
          )}
        </>
      )}
    </div>
  );
};

const CreateForm = (props: FormProps & CreateProps) => {
  const [selectedMode, setSelectedMode] = useState<string>(props.gameModes[0]);
  const { setGameId } = useGameContext();
  const { setIsHost, setToken, setTicket, setUsername } = useUserContext();
  const [currentConfig, setCurrentConfig] = useState<
    ConfigField[] | undefined
  >();
  const [loading, setLoading] = useState(false);
  const [configData, setConfigData] = useState<Map<string, FieldValueType>>(
    new Map()
  );

  useEffect(() => {
    if (props.gameModes.length > 0) {
      setSelectedMode(props.gameModes[0]);
    }
  }, [props.gameModes]);

  useEffect(() => {
    if (!props.gameModes.includes(selectedMode)) return;
    setLoading(true);
    const api = getAPI();
    const doFetch = async () => {
      await api.get(`/game/fields/${selectedMode}`).then((res) => {
        setCurrentConfig(res.data);
        setLoading(false);
      });
    };
    doFetch();
  }, [selectedMode]);

  const handleCreateGame = async () => {
    const api = getAPI();
    let id = 0;
    await api
      .post(`/game/create/${selectedMode}`, { config: mapToObj(configData) })
      .then((res) => {
        if (res.status === 200) {
          const id = res.data.id;
          const token: string = res.data.access_token;
          const ticket: string = res.data.ticket;
          setGameId(id);
          setToken(token);
          setTicket(ticket);
          setIsHost(true);
          setUsername("Host");
          redirect("/game");
        }
      });
    await api.get(`/game/config/${id}`).then((res) => {
      console.log(res.data);
    });
  };

  return (
    <div id="create-form-root">
      <Stack>
        <Title>Create</Title>
        <NativeSelect
          label="Game Mode"
          data={props.gameModes}
          onChange={(e) => setSelectedMode(e.currentTarget.value)}
        />
        {loading ? (
          <Group justify="center" align="center">
            <Loader color="blue" />
          </Group>
        ) : (
          <ConfigViewer currentConfig={currentConfig} setData={setConfigData} />
        )}
        <Button fullWidth color="green" onClick={handleCreateGame}>
          Create
        </Button>
        <Text id="switch-text" onClick={props.switch}>
          Want to join a game?
        </Text>
      </Stack>
    </div>
  );
};

export const LandingPage = () => {
  const game = useGameContext();
  const user = useUserContext();
  const [mode, setMode] = useState<"create" | "join">("join");
  const [gameModes, setGameModes] = useState<string[]>([]);
  const [msg, _] = useState(
    minecraftTexts[randomIntFromInterval(0, minecraftTexts.length - 1)]
  );
  const im = useMediaQuery("(max-width: 65em)");
  const [canReconnect, setCanReconnect] = useState(false);
  const [tried, setTried] = useState(false);
  const api = getAPI();

  const checkReconnectEligbility = async () => {
    return await api
      .get(`/game/can-reconnect/${game.gameId}/${user.ticket}`)
      .then((res) => {
        if (res.status === 200) {
          user.setIsHost(res.data.is_host);
        }
        return res.status === 200;
      });
  };
  useEffect(() => {
  }, [tried]);
  
  useEffect(() => {
    game.landingReset();
    if (tried) return;
    const checkReconnection = async () => {
      const result = await checkReconnectEligbility();
      setCanReconnect(result);
      setTried(true);
    };
    const api = getAPI();
    const doFetch = async () => {
      await api.get("/game/names/").then((res) => {
        setGameModes(res.data);
      });
    };
    doFetch();
    checkReconnection();
  }, []);

  const ReconnectPrompt = () => {
    if (!canReconnect) return <></>;
    return (
      <Text size="sm" id="reconnect-prompt" onClick={() => redirect("/game")}>
        Reconnect to your previous game ({game.gameId})?
      </Text>
    );
  };

  return (
    <div id="landing-root">
      <CrackboxLogoGrid />
      <Box id="landing-main-container">
        <Group>
          <Stack>
            <>
              {mode === "join" ? (
                <JoinForm switch={() => setMode("create")} />
              ) : (
                <CreateForm
                  switch={() => setMode("join")}
                  gameModes={gameModes}
                />
              )}
              <ReconnectPrompt />
            </>
          </Stack>
          {!im && (
            <Image
              id="logo-name"
              w={250}
              src={"/imgs/crackbox-logo-2.png"}
            />
          )}
        </Group>
        <div id="minecraft-container">
          <Text>{msg}</Text>
        </div>
      </Box>
    </div>
  );
};
