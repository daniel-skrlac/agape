import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DancingScript_700Bold, useFonts } from "@expo-google-fonts/dancing-script";

const ORANGE = "#F97316";

export default function TopBar() {
    const [fontsLoaded] = useFonts({ DancingScript_700Bold });

    return (
        <SafeAreaView edges={["top"]} style={styles.safe}>
            <View style={styles.bar}>
                <View style={styles.titleWrap}>
                    <Text
                        allowFontScaling={false}
                        style={[styles.title, fontsLoaded && { fontFamily: "DancingScript_700Bold" }]}
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
        paddingTop: 2,
        paddingBottom: 6,
    },
    title: {
        fontSize: 30,
        lineHeight: 40,
        color: ORANGE,
        letterSpacing: 0.2,
        ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: "rgba(2, 6, 23, 0.14)",
    },
});
