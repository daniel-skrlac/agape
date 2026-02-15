import { StyleSheet } from "react-native";
import Colors from "@/constants/Colors";

export const styles = StyleSheet.create({
    pressed: { opacity: 0.92 },
    disabled: { opacity: 0.6 },

    center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },

    container: { flex: 1, paddingHorizontal: 16, paddingTop: 12, gap: 14 },

    card: {
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 22,
        padding: 16,
        shadowColor: Colors.shadow,
        shadowOpacity: 0.06,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
        elevation: 2,
        backgroundColor: Colors.bg,
    },

    topRow: { flexDirection: "row", gap: 12, alignItems: "center" },

    avatarWrap: {
        width: 62,
        height: 62,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: "rgba(249,115,22,0.45)",
        padding: 3,
        backgroundColor: Colors.bg,
    },
    avatar: { width: "100%", height: "100%", borderRadius: 999 },

    title: { fontSize: 18, fontWeight: "900", color: Colors.text },
    sub: { marginTop: 3, fontSize: 13, color: Colors.sub },

    editBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: "rgba(249,115,22,0.12)",
        borderWidth: 1,
        borderColor: "rgba(249,115,22,0.35)",
    },
    editBtnText: { fontSize: 12, fontWeight: "900", color: Colors.orange },

    banner: {
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    bannerSuccess: { backgroundColor: Colors.successBg, borderColor: "rgba(34,197,94,0.35)" },
    bannerText: { fontSize: 13, fontWeight: "800" },
    bannerTextSuccess: { color: Colors.successText },

    fieldWrap: { marginBottom: 14 },

    label: { fontSize: 12, fontWeight: "900", color: Colors.sub, marginBottom: 8 },

    input: {
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: "rgba(2,6,23,0.16)",
        backgroundColor: Colors.bg,
        fontSize: 14,
        color: Colors.text,
    },
    inputDisabled: { backgroundColor: Colors.neutralBgSoft },
    inputError: { borderColor: "rgba(239,68,68,0.65)" },

    errorText: { marginTop: 6, fontSize: 12, color: Colors.dangerText, fontWeight: "700" },

    actionsRow: { flexDirection: "row", gap: 12, marginTop: 4 },

    btnGhost: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(2,6,23,0.16)",
        backgroundColor: Colors.neutralBgSoft,
        alignItems: "center",
        justifyContent: "center",
    },
    btnGhostText: { fontSize: 14, fontWeight: "900", color: Colors.text },

    btnPrimary: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: Colors.orange,
        alignItems: "center",
        justifyContent: "center",
    },
    btnPrimaryText: { fontSize: 14, fontWeight: "900", color: Colors.onPrimaryText },

    logoutBtn: {
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(239,68,68,0.35)",
        backgroundColor: Colors.dangerBg,
    },
    logoutText: { fontSize: 14, fontWeight: "900", color: Colors.dangerText },
});
