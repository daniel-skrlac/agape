import React, { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";

import Screen from "@/components/ui/Screen";
import TabScroll from "@/components/ui/TabScroll";
import AuthHeader from "@/components/auth/AuthHeader";
import FormCard from "@/components/ui/FormCard";
import PrimaryButton from "@/components/ui/PrimaryButton";
import TextField from "@/components/ui/TextField";
import { ErrorCard } from "@/components/ErrorCard";

import Strings from "@/src/constants/Strings";
import Colors from "@/src/constants/Colors";
import { useRegisterForm } from "../../src/api/hooks/auth/useRegisterForm";
import { styles } from "../../src/styles/RegisterScreen.styles";

export default function RegisterScreen() {
  const router = useRouter();
  const form = useRegisterForm();
  const scrollRef = useRef<ScrollView>(null);

  const [showPassword, setShowPassword] = useState(false);

  const scrollToField = useCallback((y: number) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
    });
  }, []);

  const handleRegister = async () => {
    const res = await form.submit();
    if (res.ok) router.replace("/");
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
              <Text style={styles.title}>{Strings.auth.registerTitle}</Text>
            </View>

            <FormCard>
              <View style={styles.form}>
                {!!form.errors.formError && (
                  <ErrorCard
                    title="Greška"
                    message={form.errors.formError}
                    actionText="Zatvori"
                    onAction={form.clearError}
                    titleLines={1}
                  />
                )}

                <TextField
                  label={Strings.auth.fullNameLabel}
                  placeholder={Strings.auth.fullNamePlaceholder}
                  value={form.values.fullName}
                  onChangeText={form.setFullName}
                  onFocus={() => scrollToField(120)}
                  onBlur={() => form.markTouched("fullName")}
                  returnKeyType="next"
                />
                {!!form.errors.fullNameError && (
                  <Text style={styles.fieldError}>{form.errors.fullNameError}</Text>
                )}

                <TextField
                  label={Strings.auth.oibLabel ?? "OIB:"}
                  placeholder={Strings.auth.oibPlaceholder}
                  value={form.values.oib}
                  onChangeText={form.setOib}
                  onFocus={() => scrollToField(185)}
                  onBlur={() => form.markTouched("oib")}
                  keyboardType="number-pad"
                  returnKeyType="next"
                />
                {!!form.errors.oibError && (
                  <Text style={styles.fieldError}>{form.errors.oibError}</Text>
                )}

                <TextField
                  label={Strings.auth.usernameLabel}
                  placeholder={Strings.auth.usernamePlaceholder}
                  autoCapitalize="none"
                  value={form.values.username}
                  onChangeText={form.setUsername}
                  onFocus={() => scrollToField(250)}
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
                  onFocus={() => scrollToField(315)}
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
              label={Strings.auth.registerButton}
              onPress={handleRegister}
              loading={form.submitting}
              disabled={!form.canSubmit}
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{Strings.auth.registerToLoginQuestion}</Text>
              <Pressable onPress={() => router.replace("/")}>
                <Text style={styles.switchLink}>{Strings.auth.registerToLoginLink}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Screen>
    </TabScroll>
  );
}
