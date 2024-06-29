import { Box, Button, Group, Image, Transition } from "@mantine/core";
import { useEffect, useState } from "react";
import useSound from "use-sound";
import whoosh from "/audio/whoosh1.mp3";

const DURATION = 1000;

export const TestTransitionPage = () => {
  const [playWhoosh] = useSound(whoosh, { volume: 0.1 });
  const [Lmounted, setLMounted] = useState(false);
  const [Rmounted, setRMounted] = useState(false);

  const mount = () => {
    if (Rmounted) {
      setLMounted(false);
      setRMounted(false);
      return;
    }
    setLMounted(true);
  }

  const onEnter = () => {
    playWhoosh();
  }

  const leftEntered = () => {
    setTimeout(() => setRMounted(true), 1000);
  }

  const rightExited = () => {
    console.log("Killing grace period")
  }

  const toggleLeft = () => {
    setLMounted(false);
    setTimeout(() => setLMounted(true), DURATION);
  }

  const toggleRight = () => {
    setRMounted(false);
    setTimeout(() => setRMounted(true), DURATION);
  }

  return (
    <Box w="100vw" p="20vw">
      <Button onClick={mount}>Start test</Button>
      <Button onClick={toggleLeft}>Toggle left</Button>
      <Button onClick={toggleRight}>Toggle right</Button>
      <Group justify={"space-between"}>
        <Transition
          mounted={Lmounted}
          transition="slide-right"
          duration={DURATION}
          exitDuration={DURATION}
          onEnter={onEnter}
          onEntered={leftEntered}
          keepMounted
        >
          {(styles) => (
            <Image style={{...styles}} src="/imgs/crackbox-logo-2.png" w={300} />
          )}
        </Transition>
        <Transition
          mounted={Rmounted}
          transition="slide-left"
          duration={DURATION}
          exitDuration={DURATION}
          onEnter={onEnter}
          onExited={rightExited}
          keepMounted
        >
          {(styles) => <Image style={{...styles}} src="/imgs/crackbox-logo-2.png" w={300} />}
        </Transition>
      </Group>
    </Box>
  );
};
