import React from "react";
import { Stack } from "expo-router";
import RequireMainWarehouse from "../../../components/RequireMainWarehouse";
import AuthBackground from "@/components/auth/AuthBackground";

export default function DispatchBookingsLayout() {
    return (
        <AuthBackground>
            <RequireMainWarehouse>
                <Stack screenOptions={{ headerShown: false, animation: "none" }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="[id]" />
                </Stack>
            </RequireMainWarehouse>
        </AuthBackground>
    );
}
