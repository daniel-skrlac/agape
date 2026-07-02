import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";

import Screen from "@/components/ui/Screen";
import AuthHeader from "@/components/auth/AuthHeader";
import TextField from "@/components/ui/TextField";
import PrimaryButton from "@/components/ui/PrimaryButton";
import FormCard from "@/components/ui/FormCard";
import TabScroll from "@/components/ui/TabScroll";

import Strings from "@/src/constants/Strings";
import Colors from "@/src/constants/Colors";
import { getToken } from "../../src/api/sessionStore";
import { ErrorCard } from "@/components/ErrorCard";
import { styles } from "../../src/styles/LoginScreen.styles";
import { useLoginForm } from "../../src/api/hooks/auth/useLoginForm";

export default function Index() {
    const router = useRouter();
    const form = useLoginForm();
    const scrollRef = useRef<ScrollView>(null);

    const [showPassword, setShowPassword] = useState(false);

    const scrollToField = useCallback((y: number) => {
        requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ y, animated: true });
        });
    }, []);

    useEffect(() => {
        let mounted = true;

        (async () => {
            const token = await getToken();
            if (!mounted) return;

            if (token) {
                router.replace("/(tabs)/home");
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

    return (
        <TabScroll
            ref={scrollRef}
            contentContainerStyle={styles.scroll}
            withScreen={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
        >
            <Screen edges={["top", "bottom", "left", "right"]} style={styles.screenTransparent}>
                <View style={styles.container}>
                    <View style={styles.top}>
                        <AuthHeader />

                        <View style={styles.header}>
                            <Text style={styles.title}>{Strings.auth.loginTitle}</Text>
                        </View>

                        <FormCard>
                            <View style={styles.form}>
                                {!!form.errors.formError && (
                                    <ErrorCard
                                        title={Strings.auth.errors.title}
                                        message={form.errors.formError}
                                        actionText="Zatvori"
                                        onAction={form.clearError}
                                        titleLines={1}
                                    />
                                )}

                                <TextField
                                    label={Strings.auth.usernameLabel}
                                    placeholder={Strings.auth.usernamePlaceholder}
                                    autoCapitalize="none"
                                    value={form.values.username}
                                    onChangeText={form.setUsername}
                                    onFocus={() => scrollToField(150)}
                                    onBlur={() => form.markTouched("username")}
                                    returnKeyType="next"
                                />
                                {!!form.errors.usernameError && (
                                    <Text style={styles.fieldError}>{form.errors.usernameError}</Text>
                                )}

                                <TextField
                                    label={Strings.auth.passwordLabel}
                                    placeholder={Strings.auth.passwordPlaceholder}
                                    secureTextEntry={!showPassword}
                                    value={form.values.password}
                                    onChangeText={form.setPassword}
                                    onFocus={() => scrollToField(215)}
                                    onBlur={() => form.markTouched("password")}
                                    returnKeyType="done"
                                    right={
                                        <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                                            <FontAwesome
                                                name={showPassword ? "eye-slash" : "eye"}
                                                size={18}
                                                color={Colors.light.inputPlaceholder}
                                            />
                                        </Pressable>
                                    }
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
                            <Text style={styles.switchText}>{Strings.auth.loginToRegisterQuestion} </Text>
                            <Pressable onPress={() => router.replace("/(auth)/register")}>
                                <Text style={styles.switchLink}>Registrirajte se.</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Screen>
        </TabScroll>
    );
}
