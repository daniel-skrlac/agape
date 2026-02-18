import { StyleSheet } from "react-native";
import Colors from "@/constants/Colors";

export const styles = StyleSheet.create({
    topBar: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    iconBtn: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: "rgba(148,163,184,0.18)",
        alignItems: "center",
        justifyContent: "center",
    },

    pad: { padding: 14, gap: 12 },
    padPlain: { padding: 14, gap: 12 },

    h1: { fontWeight: "900", color: Colors.text, fontSize: 16 },
    h2: { fontWeight: "800", color: Colors.sub, fontSize: 12 },

    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 16 },
    muted: { color: Colors.sub, fontWeight: "800" },

    statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    statusPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
    statusText: { fontWeight: "900", fontSize: 12 },

    miniPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
    miniText: { fontWeight: "900", color: Colors.text, fontSize: 11 },

    primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center" },
    primaryText: { color: "#fff", fontWeight: "900" },

    card: {
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: Colors.bg,
        padding: 12,
        gap: 10,
    },
    cardTitle: { fontWeight: "900", color: Colors.text, fontSize: 14 },

    kvGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    kvCell: {
        width: "48%",
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: "rgba(148,163,184,0.08)",
        padding: 10,
        gap: 4,
    },
    k: { color: Colors.sub, fontWeight: "900", fontSize: 11 },
    v: { color: Colors.text, fontWeight: "900", fontSize: 12 },

    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    countPill: {
        minWidth: 34,
        height: 26,
        paddingHorizontal: 10,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(249,115,22,0.12)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(249,115,22,0.30)",
    },
    countText: { fontWeight: "900", color: Colors.text, fontSize: 12 },

    empty: { color: Colors.sub, fontWeight: "800", paddingVertical: 6 },

    lineRow: {
        padding: 10,
        borderRadius: 14,
        backgroundColor: "rgba(148,163,184,0.08)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    lineTitle: { fontWeight: "900", color: Colors.text, fontSize: 13, lineHeight: 17 },
    lineSub: { marginTop: 2, fontWeight: "800", color: Colors.sub, fontSize: 12 },

    qtyBox: { minWidth: 72, alignItems: "flex-end", justifyContent: "center" },
    qty: { fontWeight: "900", color: Colors.text, fontSize: 14, textAlign: "right" },

    lbl: { color: Colors.sub, fontWeight: "900", fontSize: 12, marginTop: 4 },
    input: {
        minHeight: 76,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: "rgba(148,163,184,0.10)",
        padding: 12,
        color: Colors.text,
        fontWeight: "800",
    },

    danger: { padding: 12, borderRadius: 14, backgroundColor: "rgba(239,68,68,0.95)", alignItems: "center" },
    dangerTextBtn: { color: "#fff", fontWeight: "900" },

    secondary: { padding: 12, borderRadius: 14, backgroundColor: "rgba(148,163,184,0.18)", alignItems: "center" },
    secondaryText: { fontWeight: "900", color: Colors.text },
});
