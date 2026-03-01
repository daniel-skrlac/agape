import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";

type Props = ViewProps & {
    children: React.ReactNode;
};

export default function FormCard({ children, style, ...props }: Props) {
    return (
        <View style={[styles.card, style]} {...props}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: "rgba(255,255,255,0.92)",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.06)",

        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 2,

        boxShadow: "0px 8px 24px rgba(0,0,0,0.08)",
    },
});
