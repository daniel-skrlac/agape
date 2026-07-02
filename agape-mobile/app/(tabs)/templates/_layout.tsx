import React from "react";
import { Stack } from "expo-router";

export default function TemplatesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        title: "Predlošci",
        animation: "none",
        gestureEnabled: false
      }}
    >
      <Stack.Screen name="index" options={{ title: "Predlošci" }} />
      <Stack.Screen name="template/[id]" options={{ title: "Predložak" }} />
      <Stack.Screen name="template/[id]/edit" options={{ title: "Uredi predložak" }} />
      <Stack.Screen name="template/[id]/documents" options={{ title: "Dokumenti" }} />
      <Stack.Screen name="template/[id]/share" options={{ title: "Dijeljenje" }} />
      <Stack.Screen name="template/[id]/dispatch" options={{ title: "Kreiraj otpremu" }} />
      <Stack.Screen name="template/new" options={{ title: "Novi predložak" }} />
    </Stack>
  );
}
