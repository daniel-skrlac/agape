import React, { useCallback } from "react";
import { ActivityIndicator, LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { ErrorCard } from "@/components/ErrorCard";

type Props = {
    labelText: string;
    changeHintText: string;
    loadingText: string;
    emptyText: string;

    open: boolean;
    onToggle: () => void;

    warehouses: number[];
    loading: boolean;

    error?: any | null;
    onRetry?: () => void;

    selectedId: number | null;
    selectedLabel: string;

    onSelect: (id: number) => void;
    itemLabel: (id: number) => string;

    inlineLoading?: boolean;

    style?: any;
};

function errMsg(e: any) {
    return String(e?.message ?? e?.error?.message ?? "Greška prilikom učitavanja.");
}

export default function WarehousePickerCard(props: Props) {
    const {
        labelText,
        changeHintText,
        loadingText,
        emptyText,
        open,
        onToggle,
        warehouses,
        loading,
        error,
        onRetry,
        selectedId,
        selectedLabel,
        onSelect,
        itemLabel,
        inlineLoading,
        style,
    } = props;

    const isEmpty = !loading && !error && warehouses.length === 0;

    const onPressItem = useCallback(
        (id: number) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            onSelect(id);
        },
        [onSelect]
    );

    return (
        <View style={[P.surface, style]}>
            <Pressable onPress={onToggle} style={({ pressed }) => [P.row, pressed && P.pressed]}>
                <View style={P.iconBox}>
                    <FontAwesome name="building" size={16} color={PTheme.text} />
                </View>

                <View style={{ flex: 1 }}>
                    <Text style={P.label}>{labelText}</Text>

                    <Text style={P.value} numberOfLines={2}>
                        {loading ? loadingText : selectedLabel}
                    </Text>

                    {!!inlineLoading ? (
                        <View style={P.inlineLoadingRow}>
                            <ActivityIndicator size="small" />
                            <Text style={P.inlineLoadingText} numberOfLines={1} />
                        </View>
                    ) : null}
                </View>

                <View style={P.right}>
                    <Text style={P.hint} numberOfLines={1}>
                        {changeHintText}
                    </Text>
                    <FontAwesome name={open ? "chevron-up" : "chevron-down"} size={16} color={PTheme.muted} />
                </View>
            </Pressable>

            {open ? <View style={P.divider} /> : null}

            {open ? (
                <View style={P.dropdown}>
                    {loading ? (
                        <View style={P.dropdownRow}>
                            <ActivityIndicator size="small" />
                            <Text style={P.dropdownRowText}>{loadingText}</Text>
                        </View>
                    ) : error ? (
                        <View style={P.dropdownErrorWrap}>
                            <ErrorCard
                                title="Ne mogu učitati skladišta"
                                message={errMsg(error)}
                                actionText="Pokušaj ponovno"
                                onAction={() => onRetry?.()}
                                titleLines={1}
                                messageLines={1}
                            />
                        </View>
                    ) : isEmpty ? (
                        <View style={P.emptyWrap}>
                            <Text style={P.emptyText}>{emptyText}</Text>
                        </View>
                    ) : (
                        <View style={P.list}>
                            {warehouses.map((id) => {
                                const active = id === selectedId;
                                return (
                                    <Pressable
                                        key={id}
                                        onPress={() => onPressItem(id)}
                                        style={({ pressed }) => [
                                            P.item,
                                            active ? P.itemActive : P.itemIdle,
                                            pressed && P.pressed,
                                        ]}
                                    >
                                        <Text style={P.itemText}>{itemLabel(id)}</Text>
                                        {active ? <FontAwesome name="check" size={16} color={PTheme.text} /> : null}
                                    </Pressable>
                                );
                            })}
                        </View>
                    )}
                </View>
            ) : null}
        </View>
    );
}

const PTheme = {
    text: "#0f172a",
    muted: "rgba(15,23,42,0.55)",
    card: "rgba(255,255,255,0.92)",
    border: "rgba(15,23,42,0.10)",
    shadow: "rgba(15,23,42,0.10)",
    pressed: "rgba(15,23,42,0.04)",
};

const P = StyleSheet.create({
    surface: {
        backgroundColor: PTheme.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: PTheme.border,

        shadowColor: PTheme.shadow,
        shadowOpacity: 1,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },

        elevation: 2,

        overflow: "hidden",
    },
    row: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    pressed: {
        backgroundColor: PTheme.pressed,
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "rgba(251,146,60,0.35)",
        backgroundColor: "rgba(251,146,60,0.10)",
        alignItems: "center",
        justifyContent: "center",
    },
    label: {
        fontSize: 12,
        fontWeight: "700",
        color: "rgba(15,23,42,0.70)",
    },
    value: {
        fontSize: 14,
        fontWeight: "800",
        color: PTheme.text,
        marginTop: 2,
        lineHeight: 22,
    },
    right: {
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 4,
    },
    hint: {
        fontSize: 12,
        fontWeight: "700",
        color: PTheme.muted,
    },
    divider: {
        height: 1,
        backgroundColor: "rgba(15,23,42,0.08)",
    },
    dropdown: {
        paddingVertical: 8,
    },
    dropdownRow: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    dropdownRowText: {
        fontSize: 13,
        fontWeight: "700",
        color: "rgba(15,23,42,0.55)",
    },
    dropdownErrorWrap: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    emptyWrap: {
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    emptyText: {
        fontSize: 13,
        fontWeight: "700",
        color: "rgba(15,23,42,0.55)",
    },
    list: {
        paddingHorizontal: 8,
        paddingBottom: 8,
    },
    item: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    itemIdle: {},
    itemActive: {
        backgroundColor: "rgba(15,23,42,0.04)",
    },
    itemText: {
        fontSize: 14,
        fontWeight: "800",
        color: PTheme.text,
    },
    inlineLoadingRow: {
        marginTop: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    inlineLoadingText: {
        fontSize: 12,
        color: "rgba(15,23,42,0.45)",
    },
});
