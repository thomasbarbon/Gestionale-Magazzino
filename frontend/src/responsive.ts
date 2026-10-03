import { Platform, useWindowDimensions } from "react-native";

export function useResponsive() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 760;
  const isDesktop = width >= 1100;
  return { width, isTablet, isDesktop, isPhone: !isTablet };
}

export const isWeb = Platform.OS === "web";
