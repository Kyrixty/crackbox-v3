import { Box, Button, Group, Modal, Stack, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconDoorExit, IconHome, IconX } from "@tabler/icons-react";
import { redirect } from "@utils/redirect";

export const ToHome = () => {
  const [opened, { open, close }] = useDisclosure(false);

  const _switch = () => {
    if (opened) close;
    else open();
  };

  return (
    <>
      <Box p={10} onClick={_switch}>
        <IconHome size={24} />
      </Box>
      <Modal opened={opened} onClose={close} padding="md" size="lg">
        <Stack align="center" style={{ textAlign: "center", color: "white" }}>
          <Title>Are you sure you want to go Home?</Title>
          <Group justify="center">
            <Button onClick={() => redirect("/")} leftSection={<IconDoorExit />} color="red">
              Yes, take me Home
            </Button>
            <Button onClick={close} leftSection={<IconX />} color="green">
              No, stay in the Game
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};
