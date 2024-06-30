import { Box, Group, Image, Title } from "@mantine/core";

export const FightBanner = () => {
  return (
    <Box id="fight-banner" w="100vw">
      <Group justify="center">
        <Box p={20}>
          <Group justify="center">
            <Image
              style={{
                transform: "scale(2)",
                backgroundImage: "url('/imgs/fire.gif')",
                backgroundRepeat: "round",
                backgroundSize: "cover",
              }}
              src="/imgs/fight-logo.png"
              w={300}
            />
          </Group>
        </Box>
      </Group>
    </Box>
  );
};

export const PromptBanner = ({prompt}: {prompt: string}) => {
  return (
    <Box id="prompt-banner" w="100vw">
      <Group justify="center">
        <Box bg="black" style={{ borderRadius: 10 }} p={"20px 80px"}>
          <Title c="white" order={2}>
            {prompt}
          </Title>
        </Box>
      </Group>
    </Box>
  );
};
