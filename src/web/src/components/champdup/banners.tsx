import { Box, Group, Image } from "@mantine/core";

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
