import React, { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs, useRouter } from "expo-router";

import AuthBackground from "@/components/auth/AuthBackground";
import TopBar from "@/components/ui/TopBar";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useCurrentUser } from "@/src/api/hooks/common/useCurrentUser";

const ORANGE = "#F97316";
const INACTIVE = "#94A3B8";

function TabBarIcon(props: { name: React.ComponentProps<typeof FontAwesome>["name"]; color: string }) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

function HomeTabButton({ children, onPress, accessibilityState }: any) {
  const selected = !!accessibilityState?.selected;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          top: -10,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View
        style={{
          width: 62,
          height: 62,
          borderRadius: 31,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(255,255,255,0.95)",
          borderWidth: 1,
          borderColor: selected ? ORANGE : "rgba(2, 6, 23, 0.10)",
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        {children}
      </View>
    </Pressable>
  );
}


export default function TabLayout() {
  const router = useRouter();
  const { session, ready } = useCurrentUser();

  useEffect(() => {
    if (ready && !session) router.replace("/");
  }, [ready, session, router]);

  if (!ready) {
    return (
      <AuthBackground>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      </AuthBackground>
    );
  }

  if (!session) {
    return (
      <AuthBackground>
        <View style={styles.emptyRedirect} />
      </AuthBackground>
    );
  }

  return (
    <AuthBackground>
      <Tabs
        screenOptions={{
          headerShown: true,
          header: () => <TopBar />,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "transparent" },
          sceneStyle: { backgroundColor: "transparent" },
          tabBarHideOnKeyboard: true,

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
            tabBarIcon: ({ color }) => <TabBarIcon name="copy" color={color} />,
          }}
        />

        <Tabs.Screen
          name="sessions"
          options={{
            title: "Evidencije",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="clipboard-list-outline" size={size} color={color} />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.replace("/(tabs)/sessions");
            },
          }}
        />

        <Tabs.Screen
          name="home"
          options={{
            title: "Početna",
            tabBarLabelStyle: { marginBottom: 6 },
            tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
            tabBarButton: (props) => <HomeTabButton {...props} />,
          }}
        />

        <Tabs.Screen
          name="dispatch-bookings"
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.replace("/(tabs)/dispatch-bookings");
            },
          }}
          options={{
            title: "Pregled",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="clipboard-check-outline" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="settings"
          options={{
            title: "Postavke",
            tabBarIcon: ({ color }) => <TabBarIcon name="gear" color={color} />,
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profil",
            href: null,
          }}
        />
      </Tabs>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyRedirect: { flex: 1 },
});
