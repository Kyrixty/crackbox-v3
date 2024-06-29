import {
  Affix,
  Box,
  Button,
  Group,
  Image,
  Text,
  Title,
  Transition,
} from "@mantine/core";
import "@/css/sponsor.css";
import { useEffect, useState } from "react";
import sponsor from "/audio/flipside_sponsor.wav";
import useSound from "use-sound";

interface SponsorBannerProps {
  mounted: boolean;
}

export const SponsorBanner = ({mounted}: SponsorBannerProps) => {
  const [play] = useSound(sponsor, { volume: 0.6 });

  useEffect(() => {
    if (mounted) {
      play();
    }
  }, [mounted])

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
                    <Title style={{ ...styles, textShadow: "2px 2px 1px black" }} c="black">
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
