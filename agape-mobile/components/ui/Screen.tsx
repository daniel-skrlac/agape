import React from "react";
import { StyleSheet, View, StyleProp, ViewStyle } from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";

interface ScreenProps {
    children: React.ReactNode;
    edges?: Edge[];
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
}

const Screen: React.FC<ScreenProps> = ({
    children,
    edges = ["top", "left", "right"],
    style,
    contentStyle,
}) => {
    return (
        <SafeAreaView style={[styles.safeArea, style]} edges={edges}>
            <View style={[styles.inner, contentStyle]}>{children}</View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "transparent" },
    inner: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 32,
    },
});

export default Screen;
