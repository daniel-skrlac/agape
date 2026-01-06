import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs, useRouter } from "expo-router";

import { useColorScheme } from "@/components/useColorScheme";
import { getToken } from "../api/sessionStore";

const ORANGE = "#F97316";
const INACTIVE = "#94A3B8";

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const router = useRouter();
  useColorScheme(); // keep if you need it elsewhere

  const [checking, setChecking] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const token = await getToken();
        if (!mounted) return;
        setHasToken(!!token);
      } finally {
        if (mounted) setChecking(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!checking && !hasToken) {
      router.replace("/");
    }
  }, [checking, hasToken, router]);

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!hasToken) return null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ORANGE, // selected icon + label
        tabBarInactiveTintColor: INACTIVE,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="scan"
        options={{
          title: "Skeniraj",
          tabBarIcon: ({ color }) => <TabBarIcon name="camera" color={color} />,
        }}
      />

      <Tabs.Screen
        name="home"
        options={{
          title: "Početna",
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Postavke",
          tabBarIcon: ({ color }) => <TabBarIcon name="gear" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
