import {
  Box,
  Button,
  Checkbox,
  Loader,
  NativeSelect,
  NumberInput,
  ScrollArea,
  Space,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { ChangeEvent, useEffect, useState } from "react";
import { getAPI } from "@lib/api";
import {
  ConfigField,
  ConfigFieldType,
  FieldValueType,
} from "@lib/gamemodeconfig";
import { IconList, IconListDetails } from "@tabler/icons-react";
import "@/css/centered.css";
import "@/css/landing.css";
import { mapToJSON, mapToObj } from "@utils/map";

interface FormProps {
  switch: () => void;
}

interface CreateProps {
  gameModes: string[];
}

const JoinForm = (props: FormProps) => {
  return (
    <div id="join-form-root">
      <Stack>
        <Title>Join</Title>
        <TextInput placeholder="Username" />
        <TextInput placeholder="Game ID" />
        <Button fullWidth color="green">
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

  
  useEffect(() => setData(data), [data]);
  
  const resolveField = (field: ConfigField) => {
    const _setData = (k: string, v: FieldValueType) => {
      field.value = v;
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
          <Text onClick={() => setViewing(!viewing)} id="switch-text">
            <IconListDetails /> Advanced options
          </Text>
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
  const [cachedConfigs, setCachedConfigs] = useState<
    Map<string, ConfigField[]>
  >(new Map());
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
    console.log(selectedMode);
    if (!props.gameModes.includes(selectedMode)) return;
    setLoading(true);
    const api = getAPI();
    const doFetch = async () => {
      await api.get(`/game/fields/${selectedMode}`).then((res) => {
        let configs = cachedConfigs;
        configs.set(selectedMode, res.data);
        setCachedConfigs(configs);
        setCurrentConfig(res.data);
        setLoading(false);
      });
    };

    if (cachedConfigs.has(selectedMode)) {
      setCurrentConfig(cachedConfigs.get(selectedMode));
      setLoading(false);
    } else {
      doFetch();
    }
  }, [selectedMode]);

  const handleCreateGame = async () => {
    const api = getAPI();
    let id = 0;
    await api
      .post(`/game/create/${selectedMode}`, { config: mapToObj(configData) })
      .then((res) => {
        id = res.data;
      });
    await api.get(`/game/config/${id}`).then((res) => {
      console.log(res.data);
    });
  };

  useEffect(() => console.log(configData), [configData])

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
          <Loader color="blue" />
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
