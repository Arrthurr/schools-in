"use client"

import { useTheme as useNextTheme } from "next-themes"

export function useTheme() {
  const { theme, setTheme, systemTheme } = useNextTheme()

  return {
    theme: theme === "system" ? systemTheme : theme,
    setTheme,
    isDark: theme === "system" ? systemTheme === "dark" : theme === "dark",
    isLight: theme === "system" ? systemTheme === "light" : theme === "light",
    toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
  }
}
