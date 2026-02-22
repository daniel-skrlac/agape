import { StyleSheet } from "react-native";
import Colors from "@/constants/Colors";

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 14,
        gap: 12,
    },

    topErrorWrap: {
        marginBottom: 2,
    },

    topRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },

    segmentWrap: {
        flex: 1,
        minWidth: 0,
    },

    addBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: Colors.orange,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexShrink: 0,
    },

    addText: {
        color: Colors.onPrimaryText,
        fontWeight: "900",
    },

    pressed: {
        opacity: 0.85,
    },

    search: {
        backgroundColor: Colors.bg,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontWeight: "800",
        color: Colors.text,
    },

    list: {
        flex: 1,
    },

    listContent: {
        gap: 10,
        paddingBottom: 24,
    },

    swipeWrap: {
        borderRadius: 18,
        overflow: "hidden",
    },

    folderCard: {
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
    },

    card: {
        backgroundColor: Colors.bg,
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        padding: 14,
    },

    cardShared: {
        backgroundColor: Colors.sharedBg,
        borderColor: Colors.sharedBorder,
    },

    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    rowContent: {
        flex: 1,
    },

    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 14,
        backgroundColor: Colors.neutralBg,
        alignItems: "center",
        justifyContent: "center",
    },

    folderIconCircle: {
        backgroundColor: "rgba(255,255,255,0.55)",
    },

    iconCircleShared: {
        backgroundColor: "rgba(59,130,246,0.12)",
    },

    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
    },

    title: {
        fontSize: 15,
        fontWeight: "900",
        color: Colors.text,
    },

    badge: {
        fontSize: 11,
        fontWeight: "900",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: Colors.sharedBg,
        color: Colors.sharedText,
    },

    badgeBook: {
        backgroundColor: "rgba(34,197,94,0.18)",
        color: Colors.successText,
    },

    badgeView: {
        backgroundColor: Colors.neutralBg,
        color: Colors.text,
    },

    sub: {
        marginTop: 2,
        color: Colors.sub,
        fontWeight: "700",
    },

    desc: {
        marginTop: 4,
        color: "#475569",
        fontWeight: "600",
    },

    empty: {
        textAlign: "center",
        color: Colors.sub,
        marginTop: 20,
        fontWeight: "800",
    },

    sheetGap: {
        gap: 12,
    },

    addItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 16,
        backgroundColor: Colors.neutralBg,
    },

    addItemText: {
        fontWeight: "900",
        color: Colors.text,
    },

    primary: {
        padding: 12,
        borderRadius: 14,
        backgroundColor: Colors.orange,
        alignItems: "center",
    },

    primaryText: {
        color: Colors.onPrimaryText,
        fontWeight: "900",
    },

    disabled: {
        opacity: 0.7,
    },

    moreHeader: {
        backgroundColor: Colors.bg,
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        padding: 14,
        gap: 6,
    },

    moreTitle: {
        fontWeight: "900",
        color: Colors.text,
        fontSize: 16,
    },

    moreSub: {
        color: Colors.sub,
        fontWeight: "800",
    },

    moreItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 16,
        backgroundColor: Colors.neutralBg,
    },

    moreItemDanger: {
        backgroundColor: Colors.dangerBg,
    },

    moreItemText: {
        fontWeight: "900",
        color: Colors.text,
    },

    moreItemTextDanger: {
        color: Colors.dangerText,
    },
});

export const swipeStyles = StyleSheet.create({
    actions: {
        height: "100%",
        width: 210,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10,
        paddingRight: 8,
    },

    actionWrap: {
        height: "100%",
        justifyContent: "center",
    },

    actionBtn: {
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 12,
        minWidth: 92,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
    },

    edit: {
        backgroundColor: Colors.neutralBg,
    },

    delete: {
        backgroundColor: Colors.dangerBg,
    },

    actionText: {
        fontWeight: "900",
        color: Colors.text,
    },

    actionTextDanger: {
        color: Colors.dangerText,
    },
});