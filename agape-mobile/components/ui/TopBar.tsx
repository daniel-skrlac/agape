import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ORANGE = "#F97316";

export default function TopBar() {
    return (
        <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: "transparent" }]}>
            <View style={styles.bar}>
                <View style={styles.titleWrap}>
                    <Text
                        allowFontScaling={false}
                        style={styles.title}
                    >
                        Agape
                    </Text>
                </View>
            </View>
            <View style={styles.divider} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        backgroundColor: "transparent"
    },
    bar: {
        backgroundColor: "transparent",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 8,
        paddingBottom: 10,
        paddingHorizontal: 16,
    },
    titleWrap: {
        minHeight: 54,
        paddingTop: 4,
        paddingBottom: 8,
        paddingHorizontal: 10,
        overflow: "visible",
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontSize: 30,
        lineHeight: 52,
        fontFamily: "DancingScript_700Bold",
        color: ORANGE,
        letterSpacing: 0.2,
        textAlign: "center",
        ...(Platform.OS === "android" ? { includeFontPadding: true } : null),
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: "rgba(2, 6, 23, 0.14)",
    },
});
