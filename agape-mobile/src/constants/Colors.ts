const tintColor = "#E74916";

const TEXT = "#0F172A";
const SUB = "#64748B";
const ORANGE = "#F97316";

const Colors = {
  // base
  bg: "rgba(255,255,255,0.90)",
  border: "rgba(2, 6, 23, 0.12)",
  text: TEXT,
  sub: SUB,
  orange: ORANGE,

  // common tokens
  onPrimaryText: "#FFFFFF",
  shadow: "#000000",

  // “neutral” surfaces used across sheets/cards/buttons
  neutralBg: "rgba(148,163,184,0.18)",
  neutralBgSoft: "rgba(148,163,184,0.10)",
  neutralRail: "rgba(148,163,184,0.06)",
  inputBg: "rgba(148,163,184,0.14)",
  borderSoft: "rgba(2, 6, 23, 0.08)",

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

  // status palette (OK / WARN / BAD)
  status: {
    okBg: "rgba(34,197,94,0.14)",
    okBd: "rgba(34,197,94,0.30)",
    warnBg: "rgba(249,115,22,0.14)",
    warnBd: "rgba(249,115,22,0.30)",
    badBg: "rgba(239,68,68,0.12)",
    badBd: "rgba(239,68,68,0.28)",
  },

  // overlays/backdrops used by modals
  overlay: {
    black45: "rgba(0,0,0,0.45)",
    ink55: "rgba(2,6,23,0.55)",
    ink62: "rgba(2,6,23,0.62)",
  },

  // DateRangeSheet palette
  dateRange: {
    text: TEXT,
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

  // ValidateImpactModal palette
  validateImpact: {
    backdrop: "rgba(0,0,0,0.45)",

    headerIconBg: "rgba(148,163,184,0.18)",

    summaryBg: "rgba(148,163,184,0.10)",

    bulkHintBg: "rgba(148,163,184,0.10)",
    bulkHintBd: "rgba(2, 6, 23, 0.08)",

    rowCardBg: "rgba(148,163,184,0.08)",

    noticeBadBg: "rgba(239,68,68,0.10)",
    noticeBadBd: "rgba(239,68,68,0.25)",

    noticeWarnBg: "rgba(249,115,22,0.10)",
    noticeWarnBd: "rgba(249,115,22,0.25)",

    noticeOkBg: "rgba(34,197,94,0.10)",
    noticeOkBd: "rgba(34,197,94,0.22)",

    secondaryBtnBg: "rgba(148,163,184,0.18)",
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
