import React from "react";
import { Stack } from "expo-router";
import AuthBackground from "@/components/auth/AuthBackground";

export default function DispatchBookingsLayout() {
    return (
        <AuthBackground>
            <Stack screenOptions={{ headerShown: false, animation: "none" }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="[id]" />
            </Stack>
        </AuthBackground>
    );
}
