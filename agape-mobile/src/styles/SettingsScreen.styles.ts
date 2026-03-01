import { StyleSheet } from "react-native";
import Colors from "@/src/constants/Colors";

export const styles = StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    screen: { backgroundColor: Colors.bg },

    container: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18 },

    card: {
        backgroundColor: "rgba(255,255,255,0.78)",
        borderRadius: 22,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(2, 6, 23, 0.16)",
        padding: 16,
    },

    title: { fontSize: 18, fontWeight: "900", color: Colors.text },
    sub: { marginTop: 6, fontSize: 13, fontWeight: "700", color: "rgba(15,23,42,0.72)" },

    okPill: {
        marginTop: 12,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: "rgba(34,197,94,0.10)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(34,197,94,0.25)",
    },
    okPillText: { fontSize: 13, fontWeight: "900", color: "rgba(21,128,61,0.95)" },

    label: { marginTop: 14, fontSize: 12, fontWeight: "900", color: "rgba(15,23,42,0.72)" },

    select: {
        marginTop: 8,
        borderRadius: 16,
        borderWidth: 1.25,
        borderColor: "rgba(2,6,23,0.22)",
        backgroundColor: "rgba(255,255,255,0.85)",
        paddingHorizontal: 12,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    selectLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },

    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(249,115,22,0.35)",
        backgroundColor: "rgba(249,115,22,0.10)",
        alignItems: "center",
        justifyContent: "center",
    },

    value: { fontSize: 14, fontWeight: "900", color: Colors.text },

    fieldErr: { marginTop: 8, fontSize: 12, fontWeight: "800", color: "rgba(185,28,28,0.95)" },

    divider: { height: 1, backgroundColor: "rgba(2, 6, 23, 0.12)", marginTop: 12 },

    dropdown: { marginTop: 12, gap: 10 },

    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    rowText: { fontSize: 14, fontWeight: "800", color: "rgba(15,23,42,0.75)" },

    item: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1.25,
        borderColor: "rgba(2,6,23,0.22)",
        backgroundColor: "rgba(255,255,255,0.85)",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    itemActive: { backgroundColor: "rgba(249,115,22,0.10)", borderColor: "rgba(249,115,22,0.35)" },
    itemText: { fontSize: 14, fontWeight: "900", color: Colors.text },

    saveBtn: {
        marginTop: 16,
        borderRadius: 16,
        paddingVertical: 12,
        backgroundColor: Colors.orange,
        alignItems: "center",
        justifyContent: "center",
    },
    saveText: { fontSize: 14, fontWeight: "900", color: "#fff" },

    pressed: { opacity: 0.95 },
    disabled: { opacity: 0.6 },

    errorCardWrap: { marginTop: 12 },
});
