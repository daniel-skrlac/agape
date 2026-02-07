import React from "react";
import { Stack } from "expo-router";
import RequireMainWarehouse from "../templates/RequireMainWarehouse";

export default function DispatchBookingsLayout() {
    return (
        <RequireMainWarehouse>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="[id]" />
            </Stack>
        </RequireMainWarehouse>
    );
}
