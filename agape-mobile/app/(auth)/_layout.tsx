import React from "react";
import { Stack } from "expo-router";
import AuthBackground from "@/components/auth/AuthBackground";

export default function AuthLayout() {
    return (
        <AuthBackground>
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: "transparent" },
                    animation: "none",
                }}
            >
                <Stack.Screen name="index" />
                <Stack.Screen name="register" />
            </Stack>
        </AuthBackground>
    );
}
