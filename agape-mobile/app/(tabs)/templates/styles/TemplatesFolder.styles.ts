import { StyleSheet } from "react-native";
import Colors from "@/src/constants/Colors";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  container: {
    flex: 1,
    padding: 14,
    gap: 12,
  },

  topErrorWrap: {
    marginBottom: 2,
  },

  search: {
    backgroundColor: Colors.bg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "800",
    color: Colors.text,
  },

  list: {
    flex: 1,
  },

  listContent: {
    gap: 10,
    paddingBottom: 24,
  },

  swipeWrap: {
    borderRadius: 18,
    overflow: "hidden",
  },

  folderCard: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
  },

  card: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
  },

  cardShared: {
    backgroundColor: Colors.sharedBg,
    borderColor: Colors.sharedBorder,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  rowContent: {
    flex: 1,
  },

  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  iconCircleShared: {
    backgroundColor: "rgba(59,130,246,0.12)",
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  title: {
    fontSize: 15,
    fontWeight: "900",
    color: Colors.text,
    flexShrink: 1,
  },

  badge: {
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.sharedBg,
    color: Colors.sharedText,
    overflow: "hidden",
  },

  badgeBook: {
    backgroundColor: "rgba(34,197,94,0.18)",
    color: "#16A34A",
  },

  badgeView: {
    backgroundColor: "rgba(148,163,184,0.25)",
    color: Colors.text,
  },

  sub: {
    marginTop: 2,
    color: Colors.sub,
    fontWeight: "700",
  },

  desc: {
    marginTop: 4,
    color: "#475569",
    fontWeight: "600",
  },

  empty: {
    textAlign: "center",
    color: Colors.sub,
    marginTop: 20,
    fontWeight: "800",
  },

  centerLoading: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },

  loadingText: {
    color: Colors.sub,
    fontWeight: "800",
  },

  footerLoading: {
    paddingVertical: 12,
    alignItems: "center",
    gap: 8,
  },

  footerRetryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },

  footerRetryText: {
    color: Colors.text,
    fontWeight: "700",
  },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexShrink: 0,
  },

  addText: {
    color: "#fff",
    fontWeight: "900",
  },

  sheetGap: {
    gap: 12,
  },

  addItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(148,163,184,0.18)",
  },

  addItemText: {
    fontWeight: "900",
    color: Colors.text,
  },

  primary: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryText: {
    color: "#fff",
    fontWeight: "900",
  },

  disabled: {
    opacity: 0.65,
  },

  moreHeader: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 6,
  },

  moreTitle: {
    fontWeight: "900",
    color: Colors.text,
    fontSize: 16,
  },

  moreSub: {
    color: Colors.sub,
    fontWeight: "800",
  },

  moreItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(148,163,184,0.18)",
  },

  moreItemDanger: {
    backgroundColor: Colors.dangerBg,
  },

  moreItemText: {
    fontWeight: "900",
    color: Colors.text,
  },

  moreItemTextDanger: {
    color: Colors.dangerText,
  },
});

export const swipeStyles = StyleSheet.create({
  actions: {
    height: "100%",
    width: 210,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    paddingRight: 8,
  },

  actionWrap: {
    height: "100%",
    justifyContent: "center",
  },

  actionBtn: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minWidth: 92,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  edit: {
    backgroundColor: "rgba(148,163,184,0.20)",
  },

  delete: {
    backgroundColor: Colors.dangerBg,
  },

  actionText: {
    fontWeight: "900",
    color: Colors.text,
  },

  actionTextDanger: {
    color: Colors.dangerText,
  },
});