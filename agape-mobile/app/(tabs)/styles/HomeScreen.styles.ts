import { StyleSheet } from "react-native";

export const T = {
  surface: "#FFFFFF",
  text: "#0B1220",
  subText: "#1F2A37",
  muted: "#475569",

  border: "rgba(2, 6, 23, 0.16)",
  borderStrong: "rgba(2, 6, 23, 0.22)",
  divider: "rgba(2, 6, 23, 0.12)",

  warmBadge: "#FFD3B8",
  coolBadge: "#CFE2FF",

  warmAccent: "#F97316",
  coolAccent: "#2563EB",
  neutralAccent: "#0B1220",

  heroBg: "#FFF4EC",
  heroCardBg: "rgba(255,255,255,0.72)",

  shadow: "#000000",
};

export const RIPPLE = "rgba(2,6,23,0.08)";
const H_PADDING = 16;

export const styles = StyleSheet.create({
  flex1: { flex: 1 },
  bottomSpacer: { height: 26 },

  content: { paddingHorizontal: H_PADDING, paddingTop: 12, paddingBottom: 30, flexGrow: 1 },
  sectionGap: { marginBottom: 14 },
  sectionGapStack: { marginBottom: 14, gap: 14 },

  surface: {
    borderRadius: 22,
    backgroundColor: T.surface,
    borderWidth: 1.25,
    borderColor: T.border,
    shadowColor: T.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
    overflow: "hidden",
  },

  heroWrap: { borderRadius: 26, overflow: "hidden" },
  heroBgCard: {
    borderRadius: 26,
    backgroundColor: T.heroBg,
    borderWidth: 1.25,
    borderColor: T.border,
    padding: 16,
  },

  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  heroAccentDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: T.warmAccent },
  heroBadge: { fontSize: 12, fontWeight: "900", letterSpacing: 0.6, color: T.muted },

  heroRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroTitle: { marginTop: 2, fontSize: 24, fontWeight: "900", color: T.text },
  heroSubtitle: { marginTop: 8, fontSize: 14, lineHeight: 20, color: T.subText, maxWidth: 360 },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },

  kpiRow: { marginTop: 14, flexDirection: "row", gap: 12 },
  kpiChip: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: T.heroCardBg,
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  kpiChipIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiChipLabel: { fontSize: 12, fontWeight: "900", color: T.muted },
  kpiChipValue: { marginTop: 2, fontSize: 14, fontWeight: "900", color: T.text },

  fullWidthCard: { width: "100%" },

  whSurface: { borderColor: T.borderStrong },
  whRow: { padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  whIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "#FFF2E8",
    borderWidth: 1.25,
    borderColor: "rgba(249,115,22,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  whLabel: { fontSize: 12, fontWeight: "900", color: T.muted },
  whValue: { marginTop: 3, fontSize: 15, fontWeight: "900", color: T.text },
  whRight: { alignItems: "flex-end", gap: 6 },
  whHint: { fontSize: 12, color: T.subText },

  whLoadingRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  whLoadingInline: { fontSize: 12, color: T.subText },

  whDivider: { height: 1, backgroundColor: T.divider },

  whDropdown: { padding: 14, backgroundColor: "#FFFFFF" },
  whDropdownList: { gap: 10 },
  whDropdownLoading: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  whDropdownLoadingText: { fontSize: 14, color: T.subText },
  whDropdownEmpty: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    backgroundColor: "#FFFFFF",
  },
  whDropdownEmptyText: { fontSize: 14, color: T.subText, lineHeight: 20 },

  whItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  whItemIdle: {},
  whItemActive: { backgroundColor: "#FFF2E8", borderColor: "rgba(249,115,22,0.40)" },
  whItemText: { fontSize: 14, fontWeight: "900", color: T.text },

  pressed: { opacity: 0.97 },

  metricsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  metricTile: {
    width: "48%",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    borderLeftWidth: 5,
    shadowColor: T.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  metricNeutral: { backgroundColor: "#FFFFFF" },
  metricWarm: { backgroundColor: "#FFF6EF" },
  metricCool: { backgroundColor: "#F3F7FF" },

  metricBorderNeutral: { borderLeftColor: T.neutralAccent },
  metricBorderWarm: { borderLeftColor: T.warmAccent },
  metricBorderCool: { borderLeftColor: T.coolAccent },

  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  metricIconNeut: { backgroundColor: "#FFFFFF" },
  metricIconWarm: { backgroundColor: "#FFF2E8" },
  metricIconCool: { backgroundColor: "#DFEAFF" },
  metricTitle: { fontSize: 12, fontWeight: "900", color: T.muted },
  metricValue: { marginTop: 6, fontSize: 22, fontWeight: "900", color: T.text },

  accSurface: { borderColor: T.borderStrong },
  accHeader: { padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },

  accIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.25,
    borderColor: T.borderStrong,
  },
  accIconWarm: { backgroundColor: T.warmBadge },
  accIconCool: { backgroundColor: T.coolBadge },

  accTitle: { fontSize: 15, fontWeight: "900", color: T.text },
  accSub: { marginTop: 3, fontSize: 12, color: "rgba(15,23,42,0.78)" },

  accRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  countPill: {
    minWidth: 54,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(2,6,23,0.06)",
    borderWidth: 1.25,
    borderColor: T.divider,
    alignItems: "center",
    justifyContent: "center",
  },
  countPillText: { fontSize: 12, fontWeight: "900", color: "#000000" },

  accDivider: { height: 0, backgroundColor: T.divider },
  accBody: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 14, backgroundColor: "#FFFFFF" },

  listCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "flex-start",
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: T.divider },
  rowLeft: { flex: 1 },
  rowName: { fontSize: 13, lineHeight: 17, fontWeight: "900", color: T.text },
  rowCode: { marginTop: 3, fontSize: 11, color: T.muted },

  rowRight: { alignItems: "flex-end" },
  qtyBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1.25, borderColor: "rgba(2,6,23,0.22)" },
  qtyWarm: { backgroundColor: T.warmBadge },
  qtyCool: { backgroundColor: T.coolBadge },
  qtyText: { fontSize: 11, fontWeight: "900", color: T.text },
  rowHint: { marginTop: 4, fontSize: 11, color: T.subText },

  empty: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1.25,
    borderColor: T.borderStrong,
  },
  emptyText: { fontSize: 14, color: T.subText, lineHeight: 20 },
});
