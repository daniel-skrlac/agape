import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs, useRouter } from "expo-router";

import { useColorScheme } from "@/components/useColorScheme";
import { getToken } from "../api/sessionStore";
import AuthBackground from "@/components/auth/AuthBackground";
import TopBar from "@/components/ui/TopBar";

const ORANGE = "#F97316";
const INACTIVE = "#94A3B8";

function TabBarIcon(props: { name: React.ComponentProps<typeof FontAwesome>["name"]; color: string }) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const router = useRouter();
  useColorScheme();

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
    if (!checking && !hasToken) router.replace("/");
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
    <AuthBackground>
      <Tabs
        screenOptions={{
          headerShown: true,
          header: () => <TopBar />,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "transparent" },

          tabBarActiveTintColor: ORANGE,
          tabBarInactiveTintColor: INACTIVE,
          tabBarStyle: {
            backgroundColor: "rgba(255,255,255,0.72)",
            borderTopColor: "rgba(2, 6, 23, 0.12)",
            borderTopWidth: StyleSheet.hairlineWidth,
          },
        }}
      >

        <Tabs.Screen
          name="templates"
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.replace("/(tabs)/templates");
            },
          }}
          options={{
            title: "Predlošci",
            sceneStyle: { backgroundColor: "transparent" },
            tabBarIcon: ({ color }) => <TabBarIcon name="copy" color={color} />,
          }}
        />



        <Tabs.Screen
          name="home"
          options={{
            title: "Početna",
            sceneStyle: { backgroundColor: "transparent" },
            tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          }}
        />

        <Tabs.Screen
          name="settings"
          options={{
            title: "Postavke",
            sceneStyle: { backgroundColor: "transparent" },
            tabBarIcon: ({ color }) => <TabBarIcon name="gear" color={color} />,
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profil",
            href: null,
            sceneStyle: { backgroundColor: "transparent" },
          }}
        />
      </Tabs>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
