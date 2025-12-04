import React from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Colors from "../../constants/Colors";

interface ScreenProps {
    children: React.ReactNode;
}

const Screen: React.FC<ScreenProps> = ({ children }) => {
    return (
        <SafeAreaView
            style={styles.safeArea}
            edges={["top", "right", "bottom", "left"]}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.inner}>{children}</View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    scrollContent: {
        flexGrow: 1,
    },
    inner: {
        flex: 1,
        paddingHorizontal: 24,
        paddingVertical: 32,
        justifyContent: "space-between",
    },
});

export default Screen;
