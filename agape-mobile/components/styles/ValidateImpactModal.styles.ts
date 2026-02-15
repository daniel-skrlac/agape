import { StyleSheet } from "react-native";
import Colors from "@/constants/Colors";

const VI = Colors.validateImpact;

export const styles = StyleSheet.create({
    wrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: VI.backdrop },

    card: {
        width: "100%",
        maxWidth: 560,
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: Colors.bg,
        overflow: "hidden",
        maxHeight: "88%",
    },

    header: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },
    title: { fontWeight: "900", color: Colors.text, fontSize: 16, lineHeight: 20 },
    subtitle: { marginTop: 2, color: Colors.sub, fontWeight: "800", fontSize: 12, lineHeight: 16 },
    iconBtn: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: VI.headerIconBg,
        alignItems: "center",
        justifyContent: "center",
    },

    body: { padding: 14, gap: 12, paddingBottom: 18 },

    stateBox: {
        paddingVertical: 18,
        paddingHorizontal: 12,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    stateTitle: { fontWeight: "900", color: Colors.text, fontSize: 14 },
    stateSub: { fontWeight: "800", color: Colors.sub, fontSize: 12, textAlign: "center" },

    errBox: {
        padding: 12,
        borderRadius: 16,
        backgroundColor: Colors.dangerBg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.dangerText,
        gap: 10,
    },
    errHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    errTitle: { fontWeight: "900", color: Colors.dangerText, fontSize: 14 },
    errText: { fontWeight: "800", color: Colors.dangerText, opacity: 0.95 },

    summaryCard: {
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: VI.summaryBg,
        padding: 12,
        gap: 10,
    },

    bulkHint: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        padding: 10,
        borderRadius: 14,
        backgroundColor: VI.bulkHintBg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: VI.bulkHintBd,
    },
    bulkHintText: { flex: 1, fontWeight: "800", color: Colors.sub, fontSize: 12, lineHeight: 16 },

    summaryRow: { flexDirection: "row", gap: 10 },
    summaryCell: {
        flex: 1,
        padding: 10,
        borderRadius: 14,
        backgroundColor: Colors.bg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        gap: 2,
    },
    summaryLabel: { color: Colors.sub, fontWeight: "800", fontSize: 12 },
    summaryValue: { color: Colors.text, fontWeight: "900", fontSize: 14 },

    kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    kpiPill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    kpiText: { fontWeight: "900", color: Colors.text, fontSize: 12 },

    noticeBad: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        padding: 10,
        borderRadius: 14,
        backgroundColor: VI.noticeBadBg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: VI.noticeBadBd,
    },
    noticeBadText: { flex: 1, fontWeight: "900", color: Colors.dangerText, fontSize: 12, lineHeight: 16 },

    noticeWarn: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        padding: 10,
        borderRadius: 14,
        backgroundColor: VI.noticeWarnBg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: VI.noticeWarnBd,
    },
    noticeWarnText: { flex: 1, fontWeight: "900", color: Colors.text, fontSize: 12, lineHeight: 16 },

    noticeOk: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        padding: 10,
        borderRadius: 14,
        backgroundColor: VI.noticeOkBg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: VI.noticeOkBd,
    },
    noticeOkText: { flex: 1, fontWeight: "900", color: Colors.text, fontSize: 12, lineHeight: 16 },

    listHeader: { marginTop: 2, gap: 2 },
    listTitle: { fontWeight: "900", color: Colors.text, fontSize: 14 },
    listSub: { fontWeight: "800", color: Colors.sub, fontSize: 12 },

    itemCard: {
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: Colors.bg,
        padding: 12,
        gap: 10,
    },
    itemTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    itemName: { fontWeight: "900", color: Colors.text, fontSize: 15, lineHeight: 18 },
    itemMeta: { color: Colors.sub, fontWeight: "800", fontSize: 12, marginTop: 2 },

    badge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: "center",
        justifyContent: "center",
    },
    badgeText: { fontWeight: "900", fontSize: 11 },

    rowCard: {
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: VI.rowCardBg,
        padding: 10,
        gap: 8,
    },
    rowTitle: { fontWeight: "900", color: Colors.text, fontSize: 13 },
    rowGrid: { flexDirection: "row", alignItems: "center", gap: 10 },
    rowCell: {
        flex: 1,
        padding: 10,
        borderRadius: 12,
        backgroundColor: Colors.bg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        gap: 2,
    },
    rowLabel: { color: Colors.sub, fontWeight: "800", fontSize: 12 },
    rowValue: { color: Colors.text, fontWeight: "900", fontSize: 14 },
    rowArrow: { width: 22, alignItems: "center", justifyContent: "center" },

    primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center" },
    primaryText: { color: Colors.onPrimaryText, fontWeight: "900" },

    secondary: {
        padding: 12,
        borderRadius: 14,
        backgroundColor: VI.secondaryBtnBg,
        alignItems: "center",
    },
    secondaryText: { fontWeight: "900", color: Colors.text },
});
