import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import { Asset } from "expo-asset";
import { DancingScript_700Bold, useFonts } from "@expo-google-fonts/dancing-script";

import { queryClient } from "../src/query/queryClient";
import { KeyboardInsetProvider } from "@/src/keyboard/KeyboardInsetProvider";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [assetsReady, setAssetsReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({ DancingScript_700Bold });

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await Asset.loadAsync([
          require("../assets/images/icon.png"),
        ]);
      } finally {
        if (mounted) {
          setAssetsReady(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const ready = assetsReady && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <KeyboardInsetProvider>
          <View style={styles.root}>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: "none",
                contentStyle: { backgroundColor: "transparent" },
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          </View>
        </KeyboardInsetProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, position: "relative", backgroundColor: "#FFFFFF" },
});
