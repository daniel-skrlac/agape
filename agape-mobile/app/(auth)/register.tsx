import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import Screen from "@/components/ui/Screen";
import TabScroll from "@/components/ui/TabScroll";
import AuthHeader from "@/components/auth/AuthHeader";
import FormCard from "@/components/ui/FormCard";
import PrimaryButton from "@/components/ui/PrimaryButton";
import TextField from "@/components/ui/TextField";
import { ErrorCard } from "@/components/ErrorCard";

import Strings from "@/constants/Strings";
import { useRegisterForm } from "../api/hooks/auth/useRegisterForm";
import { styles } from "./styles/RegisterScreen.styles";

export default function RegisterScreen() {
  const router = useRouter();
  const form = useRegisterForm();

  const handleRegister = async () => {
    const res = await form.submit();
    if (res.ok) router.replace("/");
  };

  return (
    <TabScroll contentContainerStyle={styles.scroll} withScreen={false}>
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
                    messageLines={2}
                  />
                )}

                <TextField
                  label={Strings.auth.fullNameLabel}
                  placeholder={Strings.auth.fullNamePlaceholder}
                  value={form.values.fullName}
                  onChangeText={form.setFullName}
                  onBlur={() => form.markTouched("fullName")}
                  returnKeyType="next"
                />
                {!!form.errors.fullNameError && <Text style={styles.fieldError}>{form.errors.fullNameError}</Text>}

                <TextField
                  label={Strings.auth.oibLabel ?? "OIB:"}
                  placeholder={Strings.auth.oibPlaceholder}
                  value={form.values.oib}
                  onChangeText={form.setOib}
                  onBlur={() => form.markTouched("oib")}
                  keyboardType="number-pad"
                  returnKeyType="next"
                />
                {!!form.errors.oibError && <Text style={styles.fieldError}>{form.errors.oibError}</Text>}

                <TextField
                  label={Strings.auth.usernameLabel}
                  placeholder={Strings.auth.usernamePlaceholder}
                  autoCapitalize="none"
                  value={form.values.username}
                  onChangeText={form.setUsername}
                  onBlur={() => form.markTouched("username")}
                  returnKeyType="next"
                />
                {!!form.errors.usernameError && <Text style={styles.fieldError}>{form.errors.usernameError}</Text>}

                <TextField
                  label={Strings.auth.passwordLabel}
                  placeholder={Strings.auth.passwordPlaceholder}
                  secureTextEntry
                  value={form.values.password}
                  onChangeText={form.setPassword}
                  onBlur={() => form.markTouched("password")}
                  returnKeyType="done"
                />
                {!!form.errors.passwordError && <Text style={styles.fieldError}>{form.errors.passwordError}</Text>}
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
