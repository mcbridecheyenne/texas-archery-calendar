// Colors match the website: parchment, burnt orange, deep pine and TSAA blue.
import { useColorScheme } from "react-native";
import type { EventSource } from "./types";

export interface CalendarTheme {
  dark: boolean;
  background: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  subtle: string; // tinted fill for out-of-month cells, inputs
  primary: string;
  onPrimary: string;
  danger: string;
  warning: string;
  source: Record<EventSource, { solid: string; soft: string }>;
}

const light: CalendarTheme = {
  dark: false,
  background: "#F7F2EA",
  card: "#FBF8F3",
  border: "#E3D9CC",
  text: "#30231A",
  muted: "#73604F",
  subtle: "#EFE8DD",
  primary: "#BE4F17",
  onPrimary: "#FBF7F1",
  danger: "#A81B1B",
  warning: "#B45309",
  source: {
    TFAA: { solid: "#BE4F17", soft: "#F8E3D8" },
    ASA: { solid: "#295B42", soft: "#DCEDE4" },
    TSAA: { solid: "#275A91", soft: "#DFE9F5" },
  },
};

const dark: CalendarTheme = {
  dark: true,
  background: "#1C1612",
  card: "#251E19",
  border: "#3D332B",
  text: "#F0EADF",
  muted: "#B3A595",
  subtle: "#2C241E",
  primary: "#E2703A",
  onPrimary: "#1C1612",
  danger: "#F07070",
  warning: "#F0A64B",
  source: {
    TFAA: { solid: "#E2703A", soft: "#3E2618" },
    ASA: { solid: "#4FA67B", soft: "#1E3329" },
    TSAA: { solid: "#5B92D1", soft: "#1C2A3D" },
  },
};

export function useCalendarTheme(): CalendarTheme {
  return useColorScheme() === "dark" ? dark : light;
}
