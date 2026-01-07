import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import Screen from "../components/ui/Screen";
import AuthHeader from "../components/auth/AuthHeader";
import TextField from "../components/ui/TextField";
import PrimaryButton from "../components/ui/PrimaryButton";
import Strings from "../constants/Strings";
import Colors from "../constants/Colors";
import AuthBackground from "@/components/auth/AuthBackground";
import FormCard from "@/components/ui/FormCard";
import { useRegisterForm } from "./api/hooks/useRegisterForm";

export default function RegisterScreen() {
  const router = useRouter();
  const form = useRegisterForm();

  const handleRegister = async () => {
    const res = await form.submit();
    if (res.ok) {
      router.replace("/");
    }
  };

  return (
    <AuthBackground>
      <Screen edges={["top", "bottom", "left", "right"]}>
        <View style={styles.container}>
          <View style={styles.top}>
            <AuthHeader />

            <View style={styles.header}>
              <Text style={styles.title}>{Strings.auth.registerTitle}</Text>
            </View>

            <FormCard>
              <View style={styles.form}>
                {!!form.errors.formError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{form.errors.formError}</Text>
                  </View>
                )}

                <TextField
                  label={Strings.auth.fullNameLabel}
                  placeholder={Strings.auth.fullNamePlaceholder}
                  value={form.values.fullName}
                  onChangeText={form.setFullName}
                  onBlur={() => form.markTouched("fullName")}
                  returnKeyType="next"
                />
                {!!form.errors.fullNameError && (
                  <Text style={styles.fieldError}>{form.errors.fullNameError}</Text>
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
              label={Strings.auth.registerButton}
              onPress={handleRegister}
              loading={form.submitting}
              disabled={!form.canSubmit}
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>
                {Strings.auth.registerToLoginQuestion}{" "}
              </Text>
              <Link href="/" style={styles.switchLink}>
                {Strings.auth.registerToLoginLink}
              </Link>
            </View>
          </View>
        </View>
      </Screen>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  top: { flex: 1, justifyContent: "flex-start" },
  container: {
    flexGrow: 1,
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
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
