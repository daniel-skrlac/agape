import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Href, useRouter } from "expo-router";
import Colors from "@/src/constants/Colors";

type Props = {
    title: string;
    subtitle?: string;
    fallbackHref?: Href;
    right?: React.ReactNode;
    onBackPress?: () => void;
};

export default function NavigationHeader({
    title,
    subtitle,
    fallbackHref = "/(tabs)/templates",
    right,
    onBackPress,
}: Props) {
    const router = useRouter();

    const goBack = () => {
        if (onBackPress) {
            onBackPress();
            return;
        }

        router.replace(fallbackHref);
    };

    return (
        <View style={s.wrap}>
            <View style={s.left}>
                <Pressable style={s.backBtn} onPress={goBack} hitSlop={10}>
                    <FontAwesome name="arrow-left" size={18} color={Colors.text} />
                </Pressable>

                <View style={{ flex: 1 }}>
                    <Text style={s.title} numberOfLines={1}>
                        {title}
                    </Text>
                    {!!subtitle && (
                        <Text style={s.sub} numberOfLines={1}>
                            {subtitle}
                        </Text>
                    )}
                </View>
            </View>

            {!!right && <View style={s.right}>{right}</View>}
        </View>
    );
}

const s = StyleSheet.create({
    wrap: {
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        backgroundColor: "transparent",
    },
    left: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(148,163,184,0.16)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
    },
    title: { fontWeight: "900", color: Colors.text, fontSize: 16 },
    sub: { fontWeight: "800", color: Colors.sub, fontSize: 12, marginTop: 1 },
    right: { flexDirection: "row", alignItems: "center", gap: 10 },
});