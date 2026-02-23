import { StyleSheet } from "react-native";
import Colors from "@/constants/Colors";

export const MAX_W = 560;

export const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },

  container: {
    flex: 1,
    minHeight: 0,
    padding: 14,
    gap: 12,
  },

  topErrorWrap: {
    marginBottom: 2,
  },

  heroCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    padding: 14,
    gap: 10,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  heroTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },

  h1: {
    fontWeight: "900",
    color: Colors.text,
    fontSize: 22,
  },

  h1sub: {
    color: Colors.sub,
    fontWeight: "800",
  },

  addBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    flexShrink: 0,
  },

  addBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },

  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(148,163,184,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2,6,23,0.08)",
  },

  statChipText: {
    color: Colors.sub,
    fontWeight: "900",
  },

  filterWrap: {
    gap: 10,
  },

  searchWrap: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(148,163,184,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  searchInput: {
    flex: 1,
    height: 25,
    paddingVertical: 0,
    fontWeight: "800",
    color: Colors.text,
    fontSize: 14,
  },

  filterRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },

  filterPill: {
    flexGrow: 1,
    minWidth: 170,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: "rgba(148,163,184,0.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  filterPillActive: {
    backgroundColor: "rgba(249,115,22,0.10)",
    borderColor: "rgba(249,115,22,0.25)",
  },

  filterText: {
    flex: 1,
    fontWeight: "900",
    color: Colors.text,
    fontSize: 12,
  },

  list: {
    flex: 1,
    minHeight: 0,
  },

  listContent: {
    gap: 10,
    paddingBottom: 24,
  },

  center: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  helper: {
    color: Colors.sub,
    fontWeight: "800",
    textAlign: "center",
  },

  emptyCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: "rgba(148,163,184,0.08)",
    padding: 16,
    alignItems: "center",
    gap: 8,
  },

  emptyTitle: {
    fontWeight: "900",
    color: Colors.text,
  },

  emptySub: {
    color: Colors.sub,
    fontWeight: "800",
    textAlign: "center",
  },

  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    padding: 14,
    gap: 10,
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2,6,23,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontWeight: "900",
    color: Colors.text,
  },

  titleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },

  title: {
    fontWeight: "900",
    color: Colors.text,
    fontSize: 15,
  },

  sub: {
    color: Colors.sub,
    fontWeight: "800",
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  tinyPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(148,163,184,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2,6,23,0.08)",
  },

  tinyPillText: {
    fontSize: 11,
    fontWeight: "900",
    color: Colors.sub,
  },

  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },

  badgeText: {
    fontWeight: "900",
    color: Colors.text,
    fontSize: 12,
  },

  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2,6,23,0.08)",
  },

  noteText: {
    color: Colors.sub,
    fontWeight: "800",
    lineHeight: 18,
    flex: 1,
  },

  rowBtns: {
    flexDirection: "row",
    gap: 8,
  },

  primaryBtn: {
    flex: 1.15,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
  },

  primaryBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },

  cancelActionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(249,115,22,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.30)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
  },

  cancelActionBtnText: {
    color: Colors.text,
    fontWeight: "900",
    fontSize: 12,
  },

  dangerBtn: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239,68,68,0.35)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
  },

  dangerBtnText: {
    color: Colors.dangerText,
    fontWeight: "900",
    fontSize: 12,
  },

  disabled: {
    opacity: 0.6,
  },

  loadMoreWrap: {
    paddingVertical: 10,
    alignItems: "center",
    gap: 8,
  },

  loadMoreBtn: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  loadMoreText: {
    fontWeight: "900",
    color: Colors.text,
  },

  label: {
    fontWeight: "900",
    color: Colors.text,
  },

  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontWeight: "800",
    backgroundColor: "rgba(148,163,184,0.12)",
  },

  createBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },

  createBtnText: {
    color: "#fff",
    fontWeight: "900",
  },

  cancelBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.20)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2,6,23,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelBtnText: {
    fontWeight: "900",
    color: Colors.text,
  },
});