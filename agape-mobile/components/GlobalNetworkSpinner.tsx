import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

export default function GlobalNetworkSpinner() {
    const fetching = useIsFetching();
    const mutating = useIsMutating();
    const active = fetching + mutating;

    const [show, setShow] = useState(false);

    useEffect(() => {
        let t: ReturnType<typeof setTimeout> | undefined;

        if (active > 0) {
            t = setTimeout(() => setShow(true), 120); // avoid flicker
        } else {
            setShow(false);
        }

        return () => {
            if (t) clearTimeout(t);
        };
    }, [active]);

    if (!show) return null;

    return (
        <View pointerEvents="none" style={styles.overlay}>
            <View style={styles.pill}>
                <ActivityIndicator size="large" />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        elevation: 9999,
        alignItems: "center",
        justifyContent: "center", // ✅ center vertically
        backgroundColor: "rgba(0,0,0,0.06)", // subtle dim (optional)
    },
    pill: {
        paddingHorizontal: 18,
        paddingVertical: 16,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.95)",
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
});
