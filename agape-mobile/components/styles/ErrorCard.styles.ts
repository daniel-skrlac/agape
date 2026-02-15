import { StyleSheet } from "react-native";
import Colors from "@/constants/Colors";

export const styles = StyleSheet.create({
    wrap: {
        padding: 12,
        borderRadius: 16,
        backgroundColor: Colors.dangerBg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.dangerText,
        gap: 10,
    },

    header: { flexDirection: "row", alignItems: "center", gap: 8 },
    title: { fontWeight: "900", color: Colors.dangerText, fontSize: 14 },
    message: { fontWeight: "800", color: Colors.dangerText, opacity: 0.95 },

    actions: { flexDirection: "row", gap: 10 },

    primaryBtn: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: Colors.orange,
        alignItems: "center",
        justifyContent: "center",
    },
    primaryText: { color: Colors.onPrimaryText ?? "#fff", fontWeight: "900" },

    secondaryBtn: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: "rgba(148,163,184,0.18)",
        alignItems: "center",
        justifyContent: "center",
    },
    secondaryText: { fontWeight: "900", color: Colors.text },

    btnDisabled: { opacity: 0.5 },
});
