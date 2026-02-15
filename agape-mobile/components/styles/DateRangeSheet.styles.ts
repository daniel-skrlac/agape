import { StyleSheet } from "react-native";
import Colors from "@/constants/Colors";

const DR = Colors.dateRange;

export const DATE_RANGE_PAD = 16;
export const IOS_PICKER_HEIGHT = 330;

export const styles = StyleSheet.create({
  flex1: { flex: 1 },
  bodySpacer: { height: 8 },

  backdrop: {
    flex: 1,
    backgroundColor: DR.backdrop,
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    backgroundColor: DR.bg,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DR.border,
    overflow: "hidden",
    shadowColor: Colors.shadow,
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DR.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  h1: { fontWeight: "900", color: DR.text, fontSize: 18 },
  h2: { marginTop: 2, fontWeight: "800", color: DR.sub, fontSize: 13 },

  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DR.panel,
  },

  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
  },

  inputs: { flexDirection: "row", gap: 12 },
  datePill: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DR.border,
    backgroundColor: DR.panel,
    gap: 6,
  },
  datePillActive: {
    backgroundColor: DR.orangeBg,
    borderColor: DR.orangeBd,
  },
  datePillEmpty: { backgroundColor: DR.panel2 },

  dateLbl: { fontWeight: "900", color: DR.sub, fontSize: 12 },
  dateValWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  dateVal: { fontWeight: "900", color: DR.text, fontSize: 15 },

  pickerBox: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DR.border,
    backgroundColor: DR.bg,
    padding: 10,
    gap: 10,
  },
  pickerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pickerTitle: { fontWeight: "900", color: DR.text, fontSize: 13 },

  toggle: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DR.border,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: DR.panel,
  },
  tBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  tBtnActive: { backgroundColor: DR.orangeBg },
  tText: { fontWeight: "900", color: DR.sub, fontSize: 12 },
  tTextActive: { color: DR.text },

  iosPickerHeight: { height: IOS_PICKER_HEIGHT },
  iosPicker: { flex: 1, backgroundColor: DR.bg },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  qTile: {
    width: "48%",
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DR.border,
    backgroundColor: DR.panel,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qTileActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
    shadowColor: DR.quickActiveShadowColor,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  qIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DR.panel2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DR.border,
  },
  qIconWrapActive: {
    backgroundColor: DR.quickIconActiveBg,
    borderColor: DR.quickIconActiveBd,
  },

  qTitle: { fontWeight: "900", color: DR.text, fontSize: 13 },
  qTitleActive: { color: Colors.onPrimaryText },

  qSub: { marginTop: 1, fontWeight: "800", color: DR.sub, fontSize: 11 },
  qSubActive: { color: DR.quickSubActive },

  qBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: DR.quickBadgeBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DR.border,
  },
  qBadgeActive: {
    backgroundColor: DR.quickBadgeActiveBg,
    borderColor: DR.quickBadgeActiveBd,
  },
  qBadgeText: { fontWeight: "900", color: DR.text, fontSize: 11 },
  qBadgeTextActive: { color: Colors.onPrimaryText },

  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DR.border,
    flexDirection: "row",
    gap: 12,
    backgroundColor: DR.bg,
  },
  secondary: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: DR.secondaryBg,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontWeight: "900", color: DR.text },

  primary: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontWeight: "900", color: Colors.onPrimaryText },
});
