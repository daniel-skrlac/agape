import React, { useState } from "react";
import { StyleSheet, Text, View, Alert } from "react-native";
import { Link } from "expo-router";
import Screen from "../components/ui/Screen";
import AuthHeader from "../components/auth/AuthHeader";
import TextField from "../components/ui/TextField";
import PrimaryButton from "../components/ui/PrimaryButton";
import Strings from "../constants/Strings";
import Colors from "../constants/Colors";

export default function RegisterScreen() {
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = () => {
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        "Registracija",
        "Ovdje ide poziv na backend za registraciju"
      );
    }, 800);
  };

  return (
    <Screen>
      <View style={styles.top}>
        <AuthHeader />

        <View>
          <TextField
            label={Strings.auth.usernameLabel}
            placeholder={Strings.auth.usernamePlaceholder}
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
            returnKeyType="next"
          />

          <TextField
            label={Strings.auth.fullNameLabel}
            placeholder={Strings.auth.fullNamePlaceholder}
            value={fullName}
            onChangeText={setFullName}
            returnKeyType="next"
          />

          <TextField
            label={Strings.auth.passwordLabel}
            placeholder={Strings.auth.passwordPlaceholder}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            returnKeyType="done"
          />
        </View>
      </View>

      <View style={styles.bottom}>
        <PrimaryButton
          label={Strings.auth.registerButton}
          onPress={handleRegister}
          loading={loading}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flex: 1,
    justifyContent: "flex-start",
  },
  bottom: {
    gap: 12,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
    flexWrap: "wrap",
  },
  switchText: {
    fontSize: 14,
    color: "#4B5563",
  },
  switchLink: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.tintColor,
  },
});
