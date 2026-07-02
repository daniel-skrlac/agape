import { StyleSheet } from "react-native";
import Colors from "@/src/constants/Colors";

const MAX_W = 560;

export const styles = StyleSheet.create({
  modalWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  modalCard: {
    width: "100%",
    maxWidth: MAX_W,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    overflow: "hidden",
    maxHeight: "88%",
  },

  modalHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  modalTitle: {
    fontWeight: "900",
    color: Colors.text,
    fontSize: 16,
    flex: 1,
  },

  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  modalBody: {
    padding: 14,
    gap: 12,
    paddingBottom: 20,
  },

  centerBlock: {
    width: "100%",
    maxWidth: MAX_W,
    alignSelf: "center",
    gap: 12,
    alignItems: "center",
  },

  sheetTitle: {
    fontWeight: "900",
    color: Colors.text,
    textAlign: "center",
  },

  sheetSubtitle: {
    marginTop: -6,
    color: Colors.sub,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 18,
  },

  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
  },

  primaryText: {
    color: "#fff",
    fontWeight: "900",
  },

  btnWide: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  btnText: {
    fontWeight: "900",
    color: Colors.text,
  },

  secondaryBtn: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },

  secondaryBtnText: {
    fontWeight: "900",
    color: Colors.text,
  },

  rowBtns: {
    width: "100%",
    maxWidth: MAX_W,
    flexDirection: "row",
    gap: 10,
  },

  rowBtn: {
    flex: 1,
    maxWidth: undefined,
    width: undefined,
  },

  disabled: {
    opacity: 0.6,
  },

  input: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    backgroundColor: Colors.bg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "800",
    color: Colors.text,
  },

  loaderWrap: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  loadMoreInline: {
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  block: {
    width: "100%",
    maxWidth: MAX_W,
    alignSelf: "center",
    gap: 10,
  },

  blockTitle: {
    fontWeight: "900",
    color: Colors.text,
    fontSize: 14,
  },

  pickerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  selectedCount: {
    color: Colors.sub,
    fontWeight: "900",
    fontSize: 12,
  },

  muted: {
    color: Colors.sub,
    fontWeight: "700",
  },

  itemsList: {
    gap: 10,
  },

  itemRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },

  itemInfo: {
    flex: 1,
  },

  itemNameStrong: {
    fontWeight: "900",
    color: Colors.text,
    fontSize: 15,
  },

  itemMeta: {
    color: Colors.sub,
    fontWeight: "800",
  },

  qtyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(148,163,184,0.12)",
    borderRadius: 14,
    padding: 6,
  },

  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  qtyBtnText: {
    fontWeight: "900",
    color: Colors.text,
    fontSize: 18,
  },

  qtyInput: {
    width: 58,
    textAlign: "center",
    fontWeight: "900",
    color: Colors.text,
    paddingVertical: 6,
  },

  smallDangerBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
  },

  smallDangerText: {
    fontWeight: "900",
    color: Colors.dangerText,
  },

  pickRow: {
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },

  pickRowContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  pickRowInfo: {
    flex: 1,
    gap: 4,
  },

  pickTitle: {
    fontWeight: "900",
    color: Colors.text,
  },

  pickSub: {
    color: Colors.sub,
    fontWeight: "700",
  },

  addBtn: {
    minWidth: 46,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(249,115,22,0.16)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },

  addBtnText: {
    fontWeight: "900",
    color: Colors.text,
  },
});
