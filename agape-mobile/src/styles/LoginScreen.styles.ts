import { StyleSheet } from "react-native";
import Colors from "@/src/constants/Colors";

export const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 16,
  },

  screenTransparent: {
    backgroundColor: "transparent",
  },

  container: {
    flexGrow: 1,
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 16,
    gap: 14,
  },

  top: { flex: 1, justifyContent: "flex-start", gap: 10 },

  header: { width: "100%", alignItems: "center", marginBottom: 6 },
  title: { fontSize: 26, fontWeight: "900", color: Colors.text },

  form: { gap: 6 },

  fieldError: {
    marginTop: 2,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(185,28,28,0.95)",
  },

  bottom: { gap: 12 },

  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
    flexWrap: "wrap",
  },
  switchText: { fontSize: 14, color: Colors.sub, fontWeight: "700" },
  switchLink: { fontSize: 14, fontWeight: "900", color: Colors.tintColor },
});
