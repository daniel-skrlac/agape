import { StyleSheet } from "react-native";
import Colors from "@/src/constants/Colors";

export const styles = StyleSheet.create({
    screenTransparent: { flex: 1, backgroundColor: "transparent" },

    scroll: {
        flexGrow: 1,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
        width: "100%",
        maxWidth: 520,
        alignSelf: "center",
    },

    container: {
        flexGrow: 1,
        justifyContent: "space-between",
        gap: 12,
    },

    top: { flex: 1, justifyContent: "flex-start" },

    header: { width: "100%", alignItems: "center", marginBottom: 16 },
    title: { fontSize: 26, fontWeight: "800", color: Colors.light.text },

    form: { gap: 6 },

    fieldError: {
        marginTop: 2,
        marginBottom: 6,
        fontSize: 12,
        fontWeight: "700",
        color: "rgba(185,28,28,0.95)",
    },

    bottom: { gap: 12 },

    switchRow: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 8,
        flexWrap: "wrap",
        gap: 6,
    },
    switchText: { fontSize: 14, color: "rgba(75,85,99,1)" },
    switchLink: { fontSize: 14, fontWeight: "900", color: Colors.tintColor },
});
