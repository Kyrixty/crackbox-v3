import { useMediaQuery } from "@mantine/hooks";

export const isMobile = () => {
  return useMediaQuery('(min-width: 75em)');
}