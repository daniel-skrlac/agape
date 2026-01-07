import React, { useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "@/components/ui/Screen";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import Strings from "@/constants/Strings";
import { clearSession } from "@/app/api/sessionStore";
import { useUserProfile } from "@/app/api/hooks/useUserProfile";
import { useUserProfileForm } from "@/app/api/hooks/useUserProfileForm";
import { usePullToRefresh } from "../api/hooks/usePullToRefresh";
import TabScroll from "@/components/ui/TabScroll";

const ORANGE = "#F97316";

export default function ProfileScreen() {
    const p = useUserProfile();

    const { refreshing, onRefresh } = usePullToRefresh([
        () => {
            form.clearStatus();
            return p.refetch?.();
        },
    ]);

    const router = useRouter();

    const { userId, data: user, loading, error, setData } = useUserProfile();
    const [edit, setEdit] = useState(false);

    const form = useUserProfileForm({
        user,
        setUser: (u) => setData(u),
    });

    const headerName = useMemo(() => {
        if (!user) return Strings.profile.screenTitle;
        return (user as any)?.name || Strings.profile.screenTitle;
    }, [user]);

    const onLogout = async () => {
        await clearSession();
        router.replace("/");
    };

    const onSaveAndClose = async () => {
        if (!userId) return;
        const res = await form.submit(userId);
        if (res.ok) setEdit(false);
    };

    const onCancel = () => {
        setEdit(false);
        form.clearStatus();

        if (!user) return;
        form.setName((user as any)?.name ?? "");
        form.setUsername((user as any)?.username ?? "");
        form.setPassword("");
    };

    if (loading) {
        return (
            <Screen>
                <View style={styles.center}>
                    <ActivityIndicator size="large" />
                </View>
            </Screen>
        );
    }

    if (error) {
        return (
            <Screen>
                <View style={styles.center}>
                    <Text style={styles.errTitle}>{Strings.profile.errors.title}</Text>
                    <Text style={styles.errText}>{error}</Text>

                    <Pressable onPress={onLogout} style={styles.logoutBtn}>
                        <Text style={styles.logoutText}>{Strings.profile.buttons.logout}</Text>
                    </Pressable>
                </View>
            </Screen>
        );
    }

    return (
        <TabScroll refreshing={refreshing} onRefresh={onRefresh} contentContainerStyle={styles.container}>
            <Screen edges={["bottom", "left", "right"]}>
                <View style={styles.container}>
                    <View style={styles.card}>
                        <View style={styles.topRow}>
                            <View style={styles.avatarWrap}>
                                <Image source={{ uri: "https://i.pravatar.cc/256?img=12" }} style={styles.avatar} />
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text style={styles.title} numberOfLines={1}>
                                    {headerName}
                                </Text>
                                <Text style={styles.sub} numberOfLines={1}>
                                    {Strings.profile.editSubtitle}
                                </Text>
                            </View>

                            <Pressable
                                onPress={() => {
                                    form.clearStatus();
                                    setEdit((p) => !p);
                                }}
                                style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.9 }]}
                            >
                                <FontAwesome name={edit ? "close" : "pencil"} size={16} color={ORANGE} />
                                <Text style={styles.editBtnText}>
                                    {edit ? Strings.profile.buttons.close : Strings.profile.buttons.edit}
                                </Text>
                            </Pressable>
                        </View>
                    </View>

                    {/* Status banner (success / error) */}
                    {form.statusMessage ? (
                        <View style={[styles.banner, form.statusTone === "success" ? styles.bannerSuccess : styles.bannerError]}>
                            <Text style={[styles.bannerText, form.statusTone === "success" ? styles.bannerTextSuccess : styles.bannerTextError]}>
                                {form.statusMessage}
                            </Text>
                        </View>
                    ) : null}

                    <View style={styles.card}>
                        <Field
                            label={Strings.profile.labels.fullName}
                            value={form.values.name}
                            editable={edit}
                            placeholder={Strings.profile.placeholders.fullName}
                            error={form.errors.nameError}
                            onBlur={() => form.markTouched("name")}
                            onChangeText={form.setName}
                        />

                        <Field
                            label={Strings.profile.labels.username}
                            value={form.values.username}
                            editable={edit}
                            placeholder={Strings.profile.placeholders.username}
                            error={form.errors.usernameError}
                            onBlur={() => form.markTouched("username")}
                            onChangeText={form.setUsername}
                            autoCapitalize="none"
                        />

                        <Field
                            label={Strings.profile.labels.password}
                            value={form.values.password}
                            editable={edit}
                            placeholder={edit ? Strings.profile.placeholders.passwordEdit : Strings.profile.placeholders.passwordReadonly}
                            error={form.errors.passwordError}
                            onBlur={() => form.markTouched("password")}
                            onChangeText={form.setPassword}
                            autoCapitalize="none"
                            secureTextEntry
                        />

                        {edit ? (
                            <View style={styles.actionsRow}>
                                <Pressable onPress={onCancel} style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.9 }]}>
                                    <Text style={styles.btnGhostText}>{Strings.profile.buttons.cancel}</Text>
                                </Pressable>

                                <Pressable
                                    onPress={onSaveAndClose}
                                    disabled={!form.canSubmit || form.submitting}
                                    style={({ pressed }) => [
                                        styles.btnPrimary,
                                        pressed && { opacity: 0.92 },
                                        (!form.canSubmit || form.submitting) && { opacity: 0.6 },
                                    ]}
                                >
                                    {form.submitting ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.btnPrimaryText}>{Strings.profile.buttons.save}</Text>
                                    )}
                                </Pressable>
                            </View>
                        ) : null}
                    </View>

                    <View style={styles.card}>
                        <Pressable onPress={onLogout} style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.92 }]}>
                            <Text style={styles.logoutText}>{Strings.profile.buttons.logout}</Text>
                        </Pressable>
                    </View>
                </View>
            </Screen>
        </TabScroll>
    );
}

function Field(props: {
    label: string;
    value: string;
    editable: boolean;
    placeholder?: string;
    error?: string | null;
    secureTextEntry?: boolean;
    autoCapitalize?: "none" | "sentences" | "words" | "characters";
    onChangeText: (t: string) => void;
    onBlur?: () => void;
}) {
    return (
        <View style={{ marginBottom: 14 }}>
            <Text style={styles.label}>{props.label}</Text>

            <TextInput
                value={props.value}
                onChangeText={props.onChangeText}
                onBlur={props.onBlur}
                placeholder={props.placeholder}
                editable={props.editable}
                secureTextEntry={props.secureTextEntry}
                autoCapitalize={props.autoCapitalize}
                style={[
                    styles.input,
                    !props.editable && styles.inputDisabled,
                    props.error ? styles.inputError : null,
                ]}
                placeholderTextColor={"rgba(2,6,23,0.35)"}
            />

            {props.error ? <Text style={styles.errorText}>{props.error}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },

    errTitle: { fontSize: 18, fontWeight: "900", color: "#0B1220" },
    errText: { marginTop: 8, fontSize: 14, color: "rgba(15,23,42,0.75)", textAlign: "center" },

    container: { flex: 1, paddingHorizontal: 16, paddingTop: 12, gap: 14 },

    card: {
        borderWidth: 1,
        borderColor: "rgba(2,6,23,0.12)",
        borderRadius: 22,
        padding: 16,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
        elevation: 2,
        backgroundColor: "rgba(255,255,255,0.78)",
    },

    topRow: { flexDirection: "row", gap: 12, alignItems: "center" },

    avatarWrap: {
        width: 62,
        height: 62,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: "rgba(249,115,22,0.45)",
        padding: 3,
        backgroundColor: "rgba(255,255,255,0.9)",
    },
    avatar: { width: "100%", height: "100%", borderRadius: 999 },

    title: { fontSize: 18, fontWeight: "900", color: "#0B1220" },
    sub: { marginTop: 3, fontSize: 13, color: "rgba(15,23,42,0.72)" },

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
    editBtnText: { fontSize: 12, fontWeight: "900", color: ORANGE },

    banner: {
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    bannerSuccess: { backgroundColor: "#ECFDF5", borderColor: "#10B981" },
    bannerError: { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" },
    bannerText: { fontSize: 13, fontWeight: "800" },
    bannerTextSuccess: { color: "#065F46" },
    bannerTextError: { color: "#92400E" },

    label: { fontSize: 12, fontWeight: "900", color: "rgba(15,23,42,0.72)", marginBottom: 8 },

    input: {
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: "rgba(2,6,23,0.16)",
        backgroundColor: "rgba(255,255,255,0.9)",
        fontSize: 14,
        color: "#0B1220",
    },
    inputDisabled: { backgroundColor: "rgba(255,255,255,0.55)" },
    inputError: { borderColor: "rgba(239,68,68,0.65)" },

    errorText: { marginTop: 6, fontSize: 12, color: "rgba(239,68,68,0.95)", fontWeight: "700" },

    actionsRow: { flexDirection: "row", gap: 12, marginTop: 4 },

    btnGhost: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(2,6,23,0.16)",
        backgroundColor: "rgba(255,255,255,0.65)",
        alignItems: "center",
        justifyContent: "center",
    },
    btnGhostText: { fontSize: 14, fontWeight: "900", color: "rgba(2,6,23,0.78)" },

    btnPrimary: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: ORANGE,
        alignItems: "center",
        justifyContent: "center",
    },
    btnPrimaryText: { fontSize: 14, fontWeight: "900", color: "#fff" },

    logoutBtn: {
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(239,68,68,0.35)",
        backgroundColor: "rgba(239,68,68,0.10)",
    },
    logoutText: { fontSize: 14, fontWeight: "900", color: "rgba(239,68,68,0.95)" },
});
