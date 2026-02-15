const tintColor = "#E74916";

const Colors = {
  // base
  bg: "rgba(255,255,255,0.90)",
  border: "rgba(2, 6, 23, 0.12)",
  text: "#0F172A",
  sub: "#64748B",
  orange: "#F97316",

  // semantic
  sharedBg: "rgba(59,130,246,0.10)",
  sharedBorder: "rgba(59,130,246,0.25)",
  sharedText: "#1D4ED8",

  dangerBg: "rgba(239,68,68,0.12)",
  dangerText: "#7F1D1D",

  // banners
  infoBg: "rgba(59,130,246,0.10)",
  infoText: "#1D4ED8",
  successBg: "rgba(34,197,94,0.12)",
  successText: "#166534",

  // common tokens
  white: "#FFFFFF",
  black: "#000000",
  onPrimaryText: "#FFFFFF",
  shadow: "#000000",

  // DateRangeSheet palette
  dateRange: {
    text: "#0F172A",
    sub: "rgba(15,23,42,0.66)",
    border: "rgba(15,23,42,0.16)",
    bg: "#FFFFFF",
    panel: "rgba(15,23,42,0.06)",
    panel2: "rgba(15,23,42,0.03)",

    backdrop: "rgba(2,6,23,0.55)",

    orangeBg: "rgba(249,115,22,0.16)",
    orangeBd: "rgba(249,115,22,0.55)",

    // quick tiles (active)
    quickActiveShadowColor: "#000000",
    quickIconActiveBg: "rgba(255,255,255,0.22)",
    quickIconActiveBd: "rgba(255,255,255,0.35)",
    quickSubActive: "rgba(255,255,255,0.90)",

    // badges
    quickBadgeBg: "rgba(15,23,42,0.10)",
    quickBadgeActiveBg: "rgba(255,255,255,0.22)",
    quickBadgeActiveBd: "rgba(255,255,255,0.35)",

    // footer buttons
    secondaryBg: "rgba(15,23,42,0.10)",
  },

  light: {
    text: "#111827",
    background: "#FFFFFF",
    tint: tintColor,
    inputBackground: "#F3F4F6",
    inputBorder: "#E5E7EB",
    inputPlaceholder: "#9CA3AF",
    error: "#DC2626",
  },
  dark: {
    text: "#F9FAFB",
    background: "#000000",
    tint: tintColor,
    inputBackground: "#1F2933",
    inputBorder: "#4B5563",
    inputPlaceholder: "#6B7280",
    error: "#F87171",
  },

  tintColor,
} as const;

export default Colors;
