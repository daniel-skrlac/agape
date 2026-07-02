import { StyleSheet } from "react-native";
import Colors from "@/src/constants/Colors";

export const MAX_W = 560;

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 14,
        gap: 12,
    },

    list: {
        flex: 1,
    },

    loading: {
        color: Colors.sub,
        fontWeight: "800",
        textAlign: "center",
        marginTop: 20,
    },

    listContent: {
        gap: 10,
        paddingBottom: 96,
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

    card: {
        alignSelf: "center",
        width: "100%",
        maxWidth: MAX_W,
        backgroundColor: Colors.bg,
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        padding: 14,
        gap: 8,
    },

    cardHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    title: {
        fontWeight: "900",
        color: Colors.text,
        fontSize: 15,
        flex: 1,
    },

    sub: {
        color: Colors.sub,
        fontWeight: "800",
    },

    desc: {
        color: Colors.sub,
        fontWeight: "700",
    },

    actionsRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 10,
        marginTop: 4,
        flexWrap: "wrap",
    },

    actionBtn: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 14,
        backgroundColor: "rgba(148,163,184,0.18)",
        alignItems: "center",
        justifyContent: "center",
    },

    actionText: {
        fontWeight: "900",
        color: Colors.text,
    },

    actionDangerBtn: {
        backgroundColor: Colors.dangerBg,
    },

    actionDangerText: {
        color: Colors.dangerText,
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

    pickRow: {
        padding: 12,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: Colors.bg,
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

    empty: {
        textAlign: "center",
        color: Colors.sub,
        fontWeight: "800",
        marginTop: 18,
    },

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

    fieldBlock: {
        width: "100%",
        maxWidth: MAX_W,
        gap: 6,
    },

    toggle: {
        alignSelf: "center",
        width: "100%",
        maxWidth: MAX_W,
        padding: 12,
        borderRadius: 14,
        backgroundColor: "rgba(148,163,184,0.18)",
        alignItems: "center",
        justifyContent: "center",
    },

    toggleText: {
        fontWeight: "900",
        color: Colors.text,
    },

    helperTitle: {
        fontWeight: "900",
        color: Colors.text,
    },

    input: {
        width: "100%",
        backgroundColor: Colors.bg,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontWeight: "800",
        color: Colors.text,
    },

    disabled: {
        opacity: 0.6,
    },
});
