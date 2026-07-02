import { StyleSheet } from "react-native";
import Colors from "@/src/constants/Colors";

export const MAX_W = 560;
export const PLACEHOLDER = "rgba(148,163,184,0.85)";

export const s = StyleSheet.create({
    container: { padding: 14, gap: 12 },

    disabled: { opacity: 0.5 },

    label: { fontWeight: "900", color: Colors.text },
    helper: { color: Colors.sub, fontWeight: "800" },

    primary: {
        padding: 12,
        borderRadius: 14,
        backgroundColor: Colors.orange,
        alignItems: "center",
    },
    primaryText: { color: "#fff", fontWeight: "900" },

    secondaryBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: Colors.bg,
        alignItems: "center",
        justifyContent: "center",
    },
    secondaryText: { fontWeight: "900", color: Colors.text },

    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    cardCol: {
        backgroundColor: Colors.bg,
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        padding: 14,
        gap: 10,
    },
    cardColSocial: {
        borderColor: "rgba(14,165,233,0.28)",
        backgroundColor: "rgba(239,246,255,0.55)",
    },
    cardColDonation: {
        borderColor: "rgba(34,197,94,0.28)",
        backgroundColor: "rgba(240,253,244,0.60)",
    },

    cardHeaderInline: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
    },

    rowsWrap: {
        gap: 8,
        marginTop: 8,
    },

    patchWrap: {
        gap: 8,
        marginTop: 10,
        padding: 10,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: "rgba(148,163,184,0.06)",
        borderLeftWidth: 3,
        borderLeftColor: "transparent",
    },
    patchWrapSocial: {
        borderColor: "rgba(14,165,233,0.42)",
        borderLeftColor: "rgba(14,165,233,0.70)",
        backgroundColor: "rgba(224,242,254,0.70)",
    },
    patchWrapDonation: {
        borderColor: "rgba(34,197,94,0.42)",
        borderLeftColor: "rgba(34,197,94,0.70)",
        backgroundColor: "rgba(220,252,231,0.74)",
    },

    title: { fontWeight: "900", color: Colors.text, fontSize: 15 },
    sub: { color: Colors.sub, fontWeight: "800" },
    muted: { color: Colors.sub, fontWeight: "700" },

    blockTitle: { fontWeight: "900", color: Colors.text, fontSize: 14 },

    simpleRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: "rgba(148,163,184,0.10)",
        alignItems: "center",
    },
    simpleRowSocial: {
        borderColor: "rgba(14,165,233,0.42)",
        backgroundColor: "rgba(224,242,254,0.92)",
    },
    simpleRowDonation: {
        borderColor: "rgba(34,197,94,0.42)",
        backgroundColor: "rgba(220,252,231,0.92)",
    },
    simpleRight: { fontWeight: "900", color: Colors.sub },

    cardSelected: {
        backgroundColor: "rgba(249,115,22,0.10)",
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.orange,
        padding: 14,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
    },

    remove: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: Colors.dangerBg,
    },
    removeText: { fontWeight: "900", color: Colors.dangerText },

    empty: {
        textAlign: "center",
        color: Colors.sub,
        fontWeight: "800",
        marginTop: 12,
    },

    partnerActionsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
    },

    noteBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: "rgba(148,163,184,0.10)",
    },
    noteBtnText: { fontWeight: "900", color: Colors.text },

    notePill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "rgba(34,197,94,0.12)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(34,197,94,0.25)",
    },
    notePillText: { fontWeight: "900", color: Colors.text },

    checkDotSelected: {
        borderColor: Colors.orange,
        backgroundColor: Colors.orange,
        width: 30,
        height: 30,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 2,
    },
    checkDotTextSelected: { fontWeight: "900", color: "#fff" },

    pickRow: {
        padding: 12,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: Colors.bg,
        gap: 10,
        overflow: "hidden",
    },
    pickRowSocial: {
        borderColor: "rgba(14,165,233,0.30)",
        backgroundColor: "rgba(239,246,255,0.78)",
    },
    pickRowDonation: {
        borderColor: "rgba(34,197,94,0.30)",
        backgroundColor: "rgba(240,253,244,0.82)",
    },
    pickRowSelected: {
        borderColor: Colors.orange,
        backgroundColor: "rgba(249,115,22,0.10)",
    },

    pickTextBlock: {
        flex: 1,
        minWidth: 0,
    },

    pickLeft: {
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
        flex: 1,
    },

    checkDot: {
        width: 30,
        height: 30,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: Colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    checkDotText: { fontWeight: "900", color: Colors.text },

    pickTitle: { fontWeight: "900", color: Colors.text },
    pickSub: { color: Colors.sub, fontWeight: "800" },

    pill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "rgba(34,197,94,0.15)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(34,197,94,0.35)",
    },
    pillText: { fontWeight: "900", color: Colors.text },

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
        maxHeight: "85%",
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

    noteTargetLabel: {
        fontWeight: "800",
        color: Colors.sub,
        marginBottom: 10,
    },

    noteInput: {
        alignSelf: "center",
        width: "100%",
        maxWidth: MAX_W,
        minHeight: 120,
        backgroundColor: Colors.bg,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontWeight: "800",
        color: Colors.text,
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

    block: {
        width: "100%",
        maxWidth: MAX_W,
        alignSelf: "center",
        gap: 10,
    },

    loaderWrap: {
        paddingVertical: 12,
        alignItems: "center",
    },

    resultList: {
        gap: 10,
        alignSelf: "stretch",
    },

    resultRow: {
        width: "100%",
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: Colors.bg,
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    addBtn: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: "rgba(249,115,22,0.16)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(249,115,22,0.35)",
        alignItems: "center",
        justifyContent: "center",
    },
    addBtnText: { fontWeight: "900", color: Colors.text },

    pager: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        marginTop: 4,
    },
    pagerBtn: {
        width: 38,
        height: 38,
        borderRadius: 14,
        backgroundColor: "rgba(148,163,184,0.18)",
        alignItems: "center",
        justifyContent: "center",
    },
    pagerText: { fontWeight: "900", color: Colors.sub },

    itemRow: {
        alignSelf: "center",
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

    itemNameStrong: {
        fontWeight: "900",
        color: Colors.text,
        fontSize: 15,
    },
    itemMeta: { color: Colors.sub, fontWeight: "800" },

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
    smallDangerText: { fontWeight: "900", color: Colors.dangerText },

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
    btnText: { fontWeight: "900", color: Colors.text },

    tabs: {
        width: "100%",
        maxWidth: MAX_W,
        flexDirection: "row",
        gap: 10,
        alignItems: "stretch",
    },
    tabBtn: {
        flex: 1,
        minWidth: 0,
        minHeight: 48,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 14,
        backgroundColor: "rgba(148,163,184,0.18)",
        alignItems: "center",
        justifyContent: "center",
    },
    tabBtnSocial: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(14,165,233,0.34)",
        backgroundColor: "rgba(14,165,233,0.08)",
    },
    tabBtnDonation: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(34,197,94,0.34)",
        backgroundColor: "rgba(34,197,94,0.08)",
    },
    tabBtnActive: {
        backgroundColor: "rgba(249,115,22,0.18)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(249,115,22,0.35)",
    },
    tabBtnActiveSocial: {
        borderColor: "rgba(14,165,233,0.58)",
        backgroundColor: "rgba(14,165,233,0.18)",
    },
    tabBtnActiveDonation: {
        borderColor: "rgba(34,197,94,0.58)",
        backgroundColor: "rgba(34,197,94,0.18)",
    },
    tabText: { fontWeight: "900", color: Colors.sub, textAlign: "center" },
    tabTextActive: { color: Colors.text },

    docContext: {
        width: "100%",
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(249,115,22,0.28)",
        backgroundColor: "rgba(255,247,237,0.95)",
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    docContextSocial: {
        borderColor: "rgba(14,165,233,0.36)",
        backgroundColor: "rgba(239,246,255,0.96)",
    },
    docContextDonation: {
        borderColor: "rgba(34,197,94,0.36)",
        backgroundColor: "rgba(240,253,244,0.96)",
    },
    docContextPicker: {
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    docIcon: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: "rgba(249,115,22,0.14)",
        alignItems: "center",
        justifyContent: "center",
    },
    docIconSocial: {
        backgroundColor: "rgba(14,165,233,0.14)",
    },
    docIconDonation: {
        backgroundColor: "rgba(34,197,94,0.14)",
    },
    docTextBlock: {
        flex: 1,
        minWidth: 0,
    },
    docLabel: {
        color: Colors.text,
        fontWeight: "900",
        fontSize: 15,
    },
    docSub: {
        color: Colors.sub,
        fontWeight: "800",
        fontSize: 12,
        marginTop: 2,
    },
    docAddBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingHorizontal: 11,
        paddingVertical: 9,
        borderRadius: 13,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(148,163,184,0.28)",
        backgroundColor: "rgba(255,255,255,0.76)",
    },
    docAddText: {
        color: Colors.text,
        fontWeight: "900",
        fontSize: 12,
    },

    resultText: {
        fontWeight: "900",
        color: Colors.text,
    },
});
