import { useCallback, useEffect, useState } from "react";
import { PollData, usePlayerPrefs } from "@lib/context/prefs";
import { useMessenger } from "@lib/context/ws";
import {
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Title,
  Transition,
} from "@mantine/core";
import { MessageType } from "@lib/champdup";
import { isMobile } from "@utils/device";
import amogus from "/audio/amongus.wav";
import fnaf2hallway from "/audio/fnaf2-hallway.mp3";
import sponsor from "/audio/flipside_sponsor.wav";
import useSound from "use-sound";
import { useUserContext } from "@lib/context/user";
import { randomIntFromInterval } from "@utils/rand";
import { SponsorBanner } from "./champdup/sponsor";
import { getSounds } from "@utils/sound";

const VOLUME = 0.5;

export interface PollProps {
  poll_start_signal?: string;
  poll_vote_signal?: string;
}

export const DEFAULT_POLL_PROPS: PollProps = {
  poll_start_signal: "POLL",
  poll_vote_signal: "POLL_VOTE",
};

export const Poll = (props: PollProps) => {
  const prefs = usePlayerPrefs();
  props = { ...DEFAULT_POLL_PROPS, ...props };
  const [pollData, setPollData] = useState<PollData | null>(null);
  const [pollEnds, setPollEnds] = useState<number>(0);
  const [mounted, setMounted] = useState(false);
  const { lastJsonMessage, sendJsonMessage } = useMessenger();
  const { isHost } = useUserContext();
  const total =
    pollData !== null ? pollData.yes.length + pollData.no.length : 0;
  const yesPct = pollData !== null ? pollData.yes.length / total : 0;
  const noPct = pollData !== null ? pollData.no.length / total : 0;
  const im = isMobile();
  const pollSounds = getSounds([amogus, fnaf2hallway], VOLUME);
  const [sponsorPlay] = useSound(sponsor, { volume: 0.8 });
  const [sponsorActive, setSponsorActive] = useState(false);

  const _clearPollData = () => {
    setPollData(null);
    setPollEnds(0);
  };

  const clearPoll = () => setMounted(false);

  const getYesGradient = () => {
    return `linear-gradient(90deg, rgba(71,254,0,0.3) ${
      yesPct ? yesPct * 100 : 0
    }%, rgba(0,0,0,0) ${yesPct ? yesPct * 100 : 0}%)`;
  };

  const getNoGradient = () => {
    return `linear-gradient(90deg, rgba(254,6,0,0.3) ${
      noPct ? noPct * 100 : 0
    }%, rgba(0,0,0,0) ${noPct ? noPct * 100 : 0}%)`;
  };

  useEffect(() => {
    if (lastJsonMessage === null) return;
    if (lastJsonMessage.type === MessageType.SPONSOR) {
      if (isHost && !sponsorActive) {
        setSponsorActive(true);
        setTimeout(() => setSponsorActive(false), 8000);
      }
    }
    if (lastJsonMessage.type === props.poll_start_signal) {
      const poll: PollData = lastJsonMessage.value;
      const ends = new Date(poll.ends);
      const now = new Date();
      // half a second early of poll duration
      const earlyEnds = ends.getTime() - now.getTime() - 500;
      if (now >= ends) return;
      if (isHost) {
        const [play] = pollSounds[randomIntFromInterval(0, pollSounds.length - 1)];
        play();
      }
      setPollEnds(earlyEnds);
      setTimeout(clearPoll, earlyEnds);
      setPollData(lastJsonMessage.value);
      setMounted(true && prefs.showPolls);
    }
    if (lastJsonMessage.type === props.poll_vote_signal) {
      const poll: PollData = lastJsonMessage.value;
      setPollData(poll);
    }
  }, [lastJsonMessage]);

  const handleVote = (vote: "yes" | "no") =>
    sendJsonMessage({ type: MessageType.POLL_VOTE, value: vote });

  return (
    <div id="poll-listener">
      <SponsorBanner mounted={sponsorActive} />
      <Transition
        transition="slide-right"
        duration={250}
        exitDuration={250}
        mounted={mounted}
        onExited={_clearPollData}
        keepMounted
      >
        {(transitionStyle) => (
          <Paper
            shadow="lg"
            p="xl"
            withBorder
            style={
              !im
                ? {
                    ...transitionStyle,
                    position: "fixed",
                    bottom: "5vh",
                    left: "5vw",
                    zIndex: 998,
                  }
                : {
                    ...transitionStyle,
                    position: "fixed",
                    bottom: "5vh",
                    left: "50vw",
                    transform: "translate(-50%)",
                  }
            }
          >
            <Title order={im ? 6 : 4} style={{ color: "white" }}>
              {pollData?.prompt}
            </Title>
            <Stack justify="space-around" p={10}>
              <Box
                style={{
                  background: getYesGradient(),
                  color: "white",
                  borderRadius: 10,
                  border: "1px solid #47fe00",
                  textAlign: "center",
                  cursor: "pointer",
                }}
                p="5px 10px"
                w="100%"
                color="green"
                onClick={() => handleVote("yes")}
              >
                Yes ({Math.floor(yesPct ? yesPct * 100 : 0)}%)
              </Box>
              <Box
                style={{
                  background: getNoGradient(),
                  color: "white",
                  border: "1px solid #fe0600",
                  borderRadius: 10,
                  textAlign: "center",
                  cursor: "pointer",
                }}
                p="5px 10px"
                w="100%"
                color="red"
                onClick={() => handleVote("no")}
              >
                No ({Math.floor(noPct ? noPct * 100 : 0)}%)
              </Box>
            </Stack>
          </Paper>
        )}
      </Transition>
    </div>
  );
};
