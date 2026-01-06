import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import Screen from "../components/ui/Screen";
import AuthHeader from "../components/auth/AuthHeader";
import TextField from "../components/ui/TextField";
import PrimaryButton from "../components/ui/PrimaryButton";
import Strings from "../constants/Strings";
import Colors from "../constants/Colors";
import AuthBackground from "@/components/auth/AuthBackground";
import FormCard from "@/components/ui/FormCard";
import { useLoginForm } from "./api/hooks/useLoginForm";
import { getToken } from "./api/sessionStore";

export default function Index() {
    const router = useRouter();
    const form = useLoginForm();

    const [checkingAuth, setCheckingAuth] = useState(true);

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const token = await getToken();
                if (!mounted) return;

                if (token) {
                    router.replace("/(tabs)/home");
                    return;
                }
            } finally {
                if (mounted) setCheckingAuth(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [router]);

    const handleLogin = async () => {
        const res = await form.submit();
        if (res.ok) router.replace("/(tabs)/home");
    };

    if (checkingAuth) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <AuthBackground>
            <Screen>
                <View style={styles.top}>
                    <AuthHeader />

                    <View style={styles.header}>
                        <Text style={styles.title}>{Strings.auth.loginTitle}</Text>
                    </View>

                    <FormCard>
                        <View style={styles.form}>
                            {!!form.errors.formError && (
                                <View style={styles.errorBanner}>
                                    <Text style={styles.errorBannerText}>
                                        {form.errors.formError}
                                    </Text>
                                </View>
                            )}

                            <TextField
                                label={Strings.auth.usernameLabel}
                                placeholder={Strings.auth.usernamePlaceholder}
                                autoCapitalize="none"
                                value={form.values.username}
                                onChangeText={form.setUsername}
                                onBlur={() => form.markTouched("username")}
                                returnKeyType="next"
                            />
                            {!!form.errors.usernameError && (
                                <Text style={styles.fieldError}>{form.errors.usernameError}</Text>
                            )}

                            <TextField
                                label={Strings.auth.passwordLabel}
                                placeholder={Strings.auth.passwordPlaceholder}
                                secureTextEntry
                                value={form.values.password}
                                onChangeText={form.setPassword}
                                onBlur={() => form.markTouched("password")}
                                returnKeyType="done"
                            />
                            {!!form.errors.passwordError && (
                                <Text style={styles.fieldError}>{form.errors.passwordError}</Text>
                            )}
                        </View>
                    </FormCard>
                </View>

                <View style={styles.bottom}>
                    <PrimaryButton
                        label={Strings.auth.loginButton}
                        onPress={handleLogin}
                        loading={form.submitting}
                        disabled={!form.canSubmit}
                    />

                    <View style={styles.switchRow}>
                        <Text style={styles.switchText}>
                            {Strings.auth.loginToRegisterQuestion}{" "}
                        </Text>
                        <Link href="/register" style={styles.switchLink}>
                            {Strings.auth.loginToRegisterLink}
                        </Link>
                    </View>
                </View>
            </Screen>
        </AuthBackground>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    top: { flex: 1, justifyContent: "flex-start" },
    header: { width: "100%", alignItems: "center", marginBottom: 16 },
    title: { fontSize: 26, fontWeight: "800", color: Colors.light.text },
    form: { gap: 6 },
    errorBanner: {
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: "#FEF3C7",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#F59E0B",
        marginBottom: 8,
    },
    errorBannerText: { fontSize: 13, fontWeight: "700", color: "#92400E" },
    fieldError: {
        marginTop: 2,
        marginBottom: 6,
        fontSize: 12,
        fontWeight: "600",
        color: "#B91C1C",
    },
    bottom: { gap: 12 },
    switchRow: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 8,
        flexWrap: "wrap",
    },
    switchText: { fontSize: 14, color: "#4B5563" },
    switchLink: { fontSize: 14, fontWeight: "600", color: Colors.tintColor },
});
