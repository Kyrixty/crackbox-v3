import { useMediaQuery } from "@mantine/hooks";

export const isMobile = () => {
  return useMediaQuery("(max-width: 30em)");
};

export const isTablet = () => {
  return useMediaQuery("(max-width: 79.99em)");
};

export const isDesktop = () => {
  return useMediaQuery("(min-width: 80em)");
};
