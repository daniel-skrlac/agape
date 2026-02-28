import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";

import Colors from "@/src/constants/Colors";
import { useCurrentUser } from "../src/api/hooks/common/useCurrentUser";

export default function RequireMainWarehouse({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, ready } = useCurrentUser();
  const wid = session?.defaultWarehouseId ?? null;

  if (!ready) {
    return (
      <View style={s.center}>
        <Text style={s.loading}>Učitavam…</Text>
      </View>
    );
  }

  if (!session) {
    return <>{children}</>;
  }

  if (!wid) {
    return (
      <View style={s.wrap}>
        <View style={s.card}>
          <View style={s.iconCircle}>
            <FontAwesome name="exclamation-triangle" size={18} color={Colors.dangerText} />
          </View>

          <Text style={s.h1}>Postavi zadano skladište</Text>
          <Text style={s.sub}>
            Da bi koristio predloške, prvo odaberi{" "}
            <Text style={{ fontWeight: "900" }}>zadano skladište</Text> u Postavkama.
          </Text>

          <Pressable
            style={s.primary}
            onPress={() => {
              router.push("/(tabs)/settings");
            }}
          >
            <Text style={s.primaryText}>Otvori Postavke</Text>
          </Pressable>

        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 14, justifyContent: "center", gap: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loading: { color: Colors.sub, fontWeight: "800" },

  card: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 16,
    gap: 10,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dangerBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignSelf: "flex-start",
  },
  h1: { fontSize: 16, fontWeight: "900", color: Colors.text },
  sub: { color: Colors.sub, fontWeight: "700", lineHeight: 18 },

  primary: {
    marginTop: 6,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  secondary: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
  },
  secondaryText: { color: Colors.text, fontWeight: "900" },
});
