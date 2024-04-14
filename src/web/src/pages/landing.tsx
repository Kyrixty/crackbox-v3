import {
  Box,
  Button,
  Checkbox,
  Group,
  Loader,
  NativeSelect,
  NumberInput,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { getAPI } from "@lib/api";
import {
  ConfigField,
  ConfigFieldType,
  FieldValueType,
} from "@lib/gamemodeconfig";
import { IconListDetails } from "@tabler/icons-react";
import "@/css/centered.css";
import "@/css/landing.css";
import { mapToObj } from "@utils/map";
import { useUserContext } from "@lib/context/user";
import { useGameContext } from "@lib/context/game";
import { redirect } from "@utils/redirect";

interface FormProps {
  switch: () => void;
}

interface CreateProps {
  gameModes: string[];
}

const JoinForm = (props: FormProps) => {
  const { gameId, setGameId } = useGameContext();
  const { username, setUsername, setToken, setTicket, setIsHost } = useUserContext();

  const handleJoin = async () => {
    const api = getAPI();
    await api.put(`/game/join/${gameId}/${username}`).then((res) => {
      if (res.status === 200) {
        setIsHost(false);
        setToken(res.data.access_token);
        setTicket(res.data.ticket);
        redirect("/game")
      }
    });
  };

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
          onChange={(e) => setGameId(e.currentTarget.value)}
        />
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
    if (field.type === ConfigFieldType.BOOL) {
      return (
        <Checkbox
          label={field.name}
          checked={field.value as boolean}
          onChange={(e) => _setData(field.name, e.currentTarget.checked)}
        />
      );
    }
    if (field.type === ConfigFieldType.NUMBER) {
      return (
        <NumberInput
          label={field.name}
          value={field.value as number}
          onChange={(e) => _setData(field.name, e)}
        />
      );
    }
    if (field.type === ConfigFieldType.SELECT) {
      return (
        <NativeSelect
          label={field.name}
          data={field.value as []}
          onChange={(e) => _setData(field.name, e.currentTarget.value)}
        />
      );
    }
    if (field.type === ConfigFieldType.STRING) {
      return (
        <TextInput
          placeholder={field.name}
          label={field.name}
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
            <ScrollArea h={100}>
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
  const { setIsHost, setToken, setTicket } = useUserContext();
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
  const [mode, setMode] = useState<"create" | "join">("join");
  const [gameModes, setGameModes] = useState<string[]>([]);

  useEffect(() => {
    const api = getAPI();
    const doFetch = async () => {
      await api.get("/game/names/").then((res) => {
        setGameModes(res.data);
      });
    };
    doFetch();
  }, []);

  return (
    <div id="landing-root">
      <div className="centered">
        <Box id="form-container">
          {mode === "join" ? (
            <JoinForm switch={() => setMode("create")} />
          ) : (
            <CreateForm switch={() => setMode("join")} gameModes={gameModes} />
          )}
        </Box>
      </div>
    </div>
  );
};
