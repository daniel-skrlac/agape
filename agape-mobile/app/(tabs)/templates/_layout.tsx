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
      <Stack.Screen name="template/[id]/uredi" options={{ title: "Uredi predložak" }} />
      <Stack.Screen name="template/[id]/dokumenti" options={{ title: "Dokumenti" }} />
      <Stack.Screen name="template/[id]/dijeli" options={{ title: "Dijeljenje" }} />
      <Stack.Screen name="template/[id]/otpremi" options={{ title: "Kreiraj otpremu" }} />
      <Stack.Screen name="template/novi" options={{ title: "Novi predložak" }} />
    </Stack>
  );
}
