import { useMediaQuery } from "@mantine/hooks";

export const isMobile = () => {
  return useMediaQuery('(min-width: 56.25em)');
}