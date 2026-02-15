import React from "react";
import { View, StyleSheet } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { queryClient } from "./query/queryClient";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <View style={styles.root}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />

            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

            <Stack.Screen
              name="profile"
              options={{
                presentation: "modal",
                headerShown: false,
              }}
            />
          </Stack>
        </View>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, position: "relative" },
});
