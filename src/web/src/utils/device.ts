import { useMediaQuery } from "@mantine/hooks";

export const isMobile = () => {
  return useMediaQuery("(max-width: 40rem)");
};

export const isTablet = () => {
  return useMediaQuery("(min-width: 40rem) and (max-width: 100rem)");
};

export const isDesktop = () => {
  return useMediaQuery("(min-width: 100rem)");
};
