import { StyleSheet } from "react-native";
import Colors from "@/src/constants/Colors";

export const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239,68,68,0.22)",
  },

  wrapStack: {
    alignItems: "stretch",
  },

  row: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  icon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,0.14)",
  },

  textWrap: { flex: 1, gap: 2, minWidth: 0 },

  title: {
    fontWeight: "900",
    color: Colors.dangerText,
    fontSize: 13,
  },

  message: {
    fontWeight: "800",
    color: Colors.dangerText,
    fontSize: 12,
    opacity: 0.9,
    lineHeight: 17,
  },

  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2,6,23,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontWeight: "900", color: Colors.text, fontSize: 12 },

  btnStack: {
    alignSelf: "flex-end",
  },

  disabled: { opacity: 0.5 },
});
