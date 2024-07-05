import {
  Affix,
  Box,
  Button,
  Group,
  Image,
  Stack,
  Text,
  Title,
  Transition,
} from "@mantine/core";
import "@/css/sponsor.css";
import { useEffect, useState } from "react";
import sponsor from "/audio/flipside_sponsor.wav";
import shootout from "/audio/shootout.mp3";
import useSound from "use-sound";

interface SponsorBannerProps {
  mounted: boolean;
}

export const SponsorBanner = ({ mounted }: SponsorBannerProps) => {
  const [play] = useSound(sponsor, { volume: 0.6 });

  useEffect(() => {
    if (mounted) {
      play();
    }
  }, [mounted]);

  return (
    <>
      <Affix bottom="20vh" zIndex={990}>
        <Transition
          mounted={mounted}
          duration={500}
          transition="slide-right"
          keepMounted
        >
          {(styles) => (
            <Box
              style={{ ...styles }}
              p="3vh 10vh"
              id="sponsor-banner"
              w="100vw"
            >
              <Group justify="space-between">
                <Transition
                  mounted={mounted}
                  duration={3000}
                  transition="slide-up"
                >
                  {(styles) => (
                    <Image
                      id="sponsor-banner-img"
                      src="/imgs/moshpit-profile-flipside.jpg"
                      w={100}
                    />
                  )}
                </Transition>
                <Transition
                  mounted={mounted}
                  duration={3000}
                  transition="slide-left"
                >
                  {(styles) => (
                    <Title
                      style={{ ...styles, textShadow: "2px 2px 1px black" }}
                      c="black"
                    >
                      <Group align="center">
                        <Image src="/imgs/keeps-logo.png" w={100} />
                        Use code <Title c="lime">FLIPSIDE</Title>for 10% off!
                      </Group>
                    </Title>
                  )}
                </Transition>
              </Group>
            </Box>
          )}
        </Transition>
      </Affix>
    </>
  );
};

export const QuahogBanner = ({ mounted }: { mounted: boolean }) => {
  const [play] = useSound(shootout, { volume: 0.4 });

  useEffect(() => {
    if (mounted) {
      play();
    }
  }, [mounted]);

  return (
    <>
      <Affix bottom={0} zIndex={990}>
        <Transition
          mounted={mounted}
          duration={500}
          transition="slide-right"
          keepMounted
        >
          {(styles) => (
            <Box
              style={{
                ...styles,
                backgroundImage: "url('/imgs/shootout.gif')",
                backgroundSize: "cover",
                backgroundRepeat: "round",
              }}
              w="100vw"
              h="100vh"
            >
                <Box w="100%" style={{ position: "absolute", bottom: 0, left: 0, borderRadius: 0 }} bg="red">
                  <Title style={{ textAlign: "center" }}>
                    QUAHOG ATTACKED!
                  </Title>
                </Box>
            </Box>
          )}
        </Transition>
      </Affix>
    </>
  );
};
