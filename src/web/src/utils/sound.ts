import useSound from "use-sound";
import { ReturnedValue } from "use-sound/dist/types";

export const getSounds = (srcs: string[], volume: number): ReturnedValue[] => {
  let sounds: ReturnedValue[] = [];

  srcs.forEach((src) => {
    sounds.push(useSound(src, { volume }));
  });
  return sounds;
};
