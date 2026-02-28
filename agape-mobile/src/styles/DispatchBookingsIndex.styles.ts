import { StyleSheet } from "react-native";
import Colors from "@/src/constants/Colors";

export const styles = StyleSheet.create({
    screen: { backgroundColor: Colors.bg },

    pad: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12, gap: 10 },

    topErrorWrap: {
        marginTop: 2,
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

    search: {
        flex: 1,
        height: 25,
        paddingVertical: 0,
        fontWeight: "800",
        color: Colors.text,
        fontSize: 14,
    },

    filtersRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
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
    filterPillActive: { backgroundColor: "rgba(249,115,22,0.10)", borderColor: "rgba(249,115,22,0.25)" },
    filterText: { flex: 1, fontWeight: "900", color: Colors.text, fontSize: 12 },

    segment: {
        flexDirection: "row",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: "rgba(148,163,184,0.08)",
    },
    segBtn: { flex: 1, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
    segBtnActive: { backgroundColor: "rgba(249,115,22,0.14)" },
    segText: { fontWeight: "900", color: Colors.sub, fontSize: 12 },
    segTextActive: { color: Colors.text },

    list: { paddingHorizontal: 14, paddingBottom: 18, gap: 10 },
    row: {
        padding: 12,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: Colors.bg,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
    },
    rowTitle: { fontWeight: "900", color: Colors.text, fontSize: 14, lineHeight: 18 },
    rowSub: { marginTop: 4, fontWeight: "800", color: Colors.sub, fontSize: 12 },

    badge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: "center",
        justifyContent: "center",
    },
    badgeText: { fontWeight: "900", fontSize: 11 },

    empty: { textAlign: "center", color: Colors.sub, fontWeight: "800", paddingVertical: 18 },

    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 16 },
    muted: { color: Colors.sub, fontWeight: "800" },

    footerLoading: { paddingVertical: 14 },

    pickRow: {
        padding: 12,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: Colors.bg,
        gap: 4,
    },
    pickTitle: { fontWeight: "900", color: Colors.text, fontSize: 14 },
    pickSub: { fontWeight: "800", color: Colors.sub, fontSize: 12 },
});
