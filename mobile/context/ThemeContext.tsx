import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeColors {
  isDark: boolean;
  background: string;
  card: string;
  cardBorder: string;
  cardSecondary: string;
  cardHighlight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textSubtle: string;
  textInverse: string;
  primary: string;
  primaryLight: string;
  accent: string;
  border: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
  // Semantic Status Colors
  success: string;
  successBg: string;
  successBorder: string;
  warning: string;
  warningBg: string;
  warningBorder: string;
  danger: string;
  dangerBg: string;
  dangerBorder: string;
  // Component Elements
  tabBarBg: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  statusBarBg: string;
  statusBarStyle: "light-content" | "dark-content";
  // Elder Screen Elements
  brandMalayalam: string;
  brandEnglish: string;
  transcriptBoxBg: string;
  transcriptBoxBorder: string;
  responseBoxBg: string;
  responseBoxBorder: string;
  micShadow: string;
  // Role Portal / Login Cards
  elderCardBg: string;
  elderCardBorder: string;
  elderCardTitle: string;
  elderCardAction: string;
  familyCardBg: string;
  familyCardBorder: string;
  familyCardTitle: string;
  familyCardAction: string;
}

export const darkTheme: ThemeColors = {
  isDark: true,
  background: "#0D0D1A",
  card: "#1A1A2E",
  cardBorder: "#2A2A4A",
  cardSecondary: "#16162A",
  cardHighlight: "#1F1D36",
  text: "#F9FAFB",
  textSecondary: "#E5E7EB",
  textMuted: "#9CA3AF",
  textSubtle: "#6B7280",
  textInverse: "#0D0D1A",
  primary: "#6C63FF",
  primaryLight: "#A78BFA",
  accent: "#A78BFA",
  border: "#2A2A4A",
  inputBg: "#1A1A2E",
  inputBorder: "#2A2A4A",
  inputText: "#F9FAFB",
  inputPlaceholder: "#6B7280",
  success: "#10B981",
  successBg: "#06281E",
  successBorder: "#10B981",
  warning: "#F59E0B",
  warningBg: "#2A1B0B",
  warningBorder: "#F59E0B",
  danger: "#EF4444",
  dangerBg: "#2B0B0B",
  dangerBorder: "#EF4444",
  tabBarBg: "#1A1A2E",
  tabBarBorder: "#2A2A4A",
  tabBarActive: "#6C63FF",
  tabBarInactive: "#8E8E93",
  statusBarBg: "#0D0D1A",
  statusBarStyle: "light-content",
  brandMalayalam: "#A78BFA",
  brandEnglish: "#7C3AED",
  transcriptBoxBg: "#111827",
  transcriptBoxBorder: "#374151",
  responseBoxBg: "#1A1A2E",
  responseBoxBorder: "#6C63FF44",
  micShadow: "#6C63FF",
  elderCardBg: "#16162C",
  elderCardBorder: "#6C63FF",
  elderCardTitle: "#F9FAFB",
  elderCardAction: "#A78BFA",
  familyCardBg: "#11221A",
  familyCardBorder: "#10B981",
  familyCardTitle: "#F9FAFB",
  familyCardAction: "#34D399",
};

export const lightTheme: ThemeColors = {
  isDark: false,
  background: "#F8FAFC",
  card: "#FFFFFF",
  cardBorder: "#E2E8F0",
  cardSecondary: "#F1F5F9",
  cardHighlight: "#EEF2FF",
  text: "#0F172A",
  textSecondary: "#1E293B",
  textMuted: "#64748B",
  textSubtle: "#94A3B8",
  textInverse: "#FFFFFF",
  primary: "#4F46E5",
  primaryLight: "#6366F1",
  accent: "#4338CA",
  border: "#E2E8F0",
  inputBg: "#FFFFFF",
  inputBorder: "#CBD5E1",
  inputText: "#0F172A",
  inputPlaceholder: "#94A3B8",
  success: "#059669",
  successBg: "#ECFDF5",
  successBorder: "#A7F3D0",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  warningBorder: "#FDE68A",
  danger: "#DC2626",
  dangerBg: "#FEF2F2",
  dangerBorder: "#FECACA",
  tabBarBg: "#FFFFFF",
  tabBarBorder: "#E2E8F0",
  tabBarActive: "#4F46E5",
  tabBarInactive: "#64748B",
  statusBarBg: "#F8FAFC",
  statusBarStyle: "dark-content",
  brandMalayalam: "#4338CA",
  brandEnglish: "#4F46E5",
  transcriptBoxBg: "#FFFFFF",
  transcriptBoxBorder: "#CBD5E1",
  responseBoxBg: "#EEF2FF",
  responseBoxBorder: "#C7D2FE",
  micShadow: "#4F46E5",
  elderCardBg: "#F5F3FF",
  elderCardBorder: "#818CF8",
  elderCardTitle: "#1E1B4B",
  elderCardAction: "#4F46E5",
  familyCardBg: "#ECFDF5",
  familyCardBorder: "#34D399",
  familyCardTitle: "#064E3B",
  familyCardAction: "#059669",
};

export interface ThemeContextType {
  themeMode: ThemeMode;
  theme: ThemeColors;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  themeMode: "dark",
  theme: darkTheme,
  isDark: true,
  setThemeMode: () => {},
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");

  const effectiveIsDark =
    themeMode === "system"
      ? systemColorScheme !== "light"
      : themeMode === "dark";

  const theme = effectiveIsDark ? darkTheme : lightTheme;

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        theme,
        isDark: effectiveIsDark,
        setThemeMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
