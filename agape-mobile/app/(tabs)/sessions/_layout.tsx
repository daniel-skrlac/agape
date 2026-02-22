import React from "react";
import { Stack } from "expo-router";
import RequireMainWarehouse from "../../../components/RequireMainWarehouse";
import AuthBackground from "@/components/auth/AuthBackground";

export default function SessionsLayout() {
  return (
    <AuthBackground>
      <RequireMainWarehouse>
        <Stack screenOptions={{ headerShown: false, animation: "none" }}>
          <Stack.Screen name="index" />

          <Stack.Screen name="[id]/index" />
          <Stack.Screen name="[id]/partner" />
          <Stack.Screen name="[id]/entry" />
          <Stack.Screen name="[id]/template" />
          <Stack.Screen name="[id]/items" />
        </Stack>
      </RequireMainWarehouse>
    </AuthBackground>
  );
}
