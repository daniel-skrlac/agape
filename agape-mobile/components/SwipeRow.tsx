import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Colors from "@/constants/Colors";

type Props = {
    children: React.ReactNode;
    onEdit?: () => void;
    onDelete?: () => void;
    editLabel?: string;
    deleteLabel?: string;
};

export function SwipeRow({ children, onEdit, onDelete, editLabel = "Uredi", deleteLabel = "Obriši" }: Props) {
    const hasActions = !!onEdit || !!onDelete;

    const renderRight = useMemo(() => {
        if (!hasActions) return undefined;

        return () => (
            <View style={s.actions}>
                {!!onEdit && (
                    <Pressable style={[s.actionBtn, s.edit]} onPress={onEdit}>
                        <FontAwesome name="pencil" size={16} color={Colors.text} />
                        <Text style={s.actionText}>{editLabel}</Text>
                    </Pressable>
                )}

                {!!onDelete && (
                    <Pressable style={[s.actionBtn, s.delete]} onPress={onDelete}>
                        <FontAwesome name="trash" size={16} color={Colors.dangerText} />
                        <Text style={[s.actionText, { color: Colors.dangerText }]}>{deleteLabel}</Text>
                    </Pressable>
                )}
            </View>
        );
    }, [hasActions, onEdit, onDelete, editLabel, deleteLabel]);

    if (!hasActions) return <>{children}</>;

    return (
        <Swipeable
            renderRightActions={renderRight}
            overshootRight={false}
            friction={2}
            rightThreshold={40}
        >
            {children}
        </Swipeable>
    );
}

const s = StyleSheet.create({
    actions: {
        flexDirection: "row",
        alignItems: "stretch",
        gap: 10,
        paddingLeft: 10,
    },
    actionBtn: {
        width: 88,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    edit: {
        backgroundColor: "rgba(148,163,184,0.22)",
    },
    delete: {
        backgroundColor: Colors.dangerBg,
    },
    actionText: {
        fontWeight: "900",
        color: Colors.text,
        fontSize: 12,
    },
});
