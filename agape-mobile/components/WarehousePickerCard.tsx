import React, { useCallback, useMemo } from "react";
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

    const isEmpty = useMemo(() => !loading && !error && warehouses.length === 0, [loading, error, warehouses.length]);

    const onPressItem = useCallback(
        (id: number) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            onSelect(id);
        },
        [onSelect]
    );

    return (
        <View style={[S.surface, style]}>
            {/* Header row */}
            <Pressable onPress={onToggle} style={({ pressed }) => [S.row, pressed && S.pressed]}>
                <View style={S.iconBox}>
                    <FontAwesome name="building" size={16} color={Theme.text} />
                </View>

                <View style={{ flex: 1 }}>
                    <Text style={S.label}>{labelText}</Text>

                    <Text style={S.value} numberOfLines={2}>
                        {loading ? loadingText : selectedLabel}
                    </Text>

                    {!!inlineLoading ? (
                        <View style={S.inlineLoadingRow}>
                            <ActivityIndicator size="small" />
                            <Text style={S.inlineLoadingText} numberOfLines={1} />
                        </View>
                    ) : null}
                </View>

                <View style={S.right}>
                    <Text style={S.hint} numberOfLines={1}>
                        {changeHintText}
                    </Text>
                    <FontAwesome name={open ? "chevron-up" : "chevron-down"} size={16} color={Theme.muted} />
                </View>
            </Pressable>

            {open ? <View style={S.divider} /> : null}

            {/* Dropdown */}
            {open ? (
                <View style={S.dropdown}>
                    {loading ? (
                        <View style={S.dropdownRow}>
                            <ActivityIndicator size="small" />
                            <Text style={S.dropdownRowText}>{loadingText}</Text>
                        </View>
                    ) : error ? (
                        <View style={S.dropdownErrorWrap}>
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
                        <View style={S.emptyWrap}>
                            <Text style={S.emptyText}>{emptyText}</Text>
                        </View>
                    ) : (
                        <View style={S.list}>
                            {warehouses.map((id, idx) => {
                                const active = id === selectedId;
                                const showDivider = idx < warehouses.length - 1;

                                return (
                                    <View key={id} style={S.itemWrap}>
                                        <Pressable
                                            onPress={() => onPressItem(id)}
                                            style={({ pressed }) => [
                                                S.item,
                                                active ? S.itemActive : S.itemIdle,
                                                pressed && S.itemPressed,
                                            ]}
                                            hitSlop={8}
                                        >
                                            <Text style={[S.itemText, active && S.itemTextActive]}>{itemLabel(id)}</Text>

                                            {active ? (
                                                <View style={S.checkPill}>
                                                    <FontAwesome name="check" size={14} color={Theme.text} />
                                                </View>
                                            ) : (
                                                <View style={S.checkPillGhost} />
                                            )}
                                        </Pressable>

                                        {showDivider ? <View style={S.itemDivider} /> : null}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            ) : null}
        </View>
    );
}

const Theme = {
    text: "#0f172a",
    muted: "rgba(15,23,42,0.55)",

    card: "rgba(255,255,255,0.92)",
    border: "rgba(15,23,42,0.10)",
    shadow: "rgba(15,23,42,0.10)",

    pressed: "rgba(15,23,42,0.04)",
    pressedStrong: "rgba(15,23,42,0.07)",

    divider: "rgba(15,23,42,0.08)",
    dividerSoft: "rgba(15,23,42,0.06)",

    accentBorder: "rgba(251,146,60,0.35)",
    accentFill: "rgba(251,146,60,0.10)",

    activeFill: "rgba(15,23,42,0.04)",
};

const S = StyleSheet.create({
    surface: {
        backgroundColor: Theme.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: Theme.border,

        shadowColor: Theme.shadow,
        shadowOpacity: 1,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },

        elevation: 2,
        overflow: "hidden",
    },

    row: {
        paddingHorizontal: 14,
        paddingVertical: 18,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },

    pressed: {
        backgroundColor: Theme.pressed,
    },

    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Theme.accentBorder,
        backgroundColor: Theme.accentFill,
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
        color: Theme.text,
        marginTop: 2,
        lineHeight: 18,
    },

    right: {
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 4,
    },

    hint: {
        fontSize: 12,
        fontWeight: "700",
        color: Theme.muted,
    },

    divider: {
        height: 1,
        backgroundColor: Theme.divider,
    },

    dropdown: {
        paddingTop: 6,
        paddingBottom: 10,
    },

    dropdownRow: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    dropdownRowText: {
        fontSize: 13,
        fontWeight: "700",
        color: Theme.muted,
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
        color: Theme.muted,
    },

    list: {
        paddingHorizontal: 10,
    },

    itemWrap: {
        borderRadius: 14,
        overflow: "hidden",
    },

    item: {
        paddingHorizontal: 12,
        paddingVertical: 14,
        minHeight: 50,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    itemIdle: {},

    itemActive: {
        backgroundColor: Theme.activeFill,
    },

    itemPressed: {
        backgroundColor: Theme.pressedStrong,
    },

    itemText: {
        fontSize: 15,
        fontWeight: "800",
        color: Theme.text,
    },

    itemTextActive: {
        color: Theme.text,
    },

    itemDivider: {
        height: 1,
        backgroundColor: Theme.dividerSoft,
        marginLeft: 12,
        marginRight: 12,
    },

    checkPill: {
        width: 28,
        height: 28,
        borderRadius: 10,
        backgroundColor: "rgba(15,23,42,0.06)",
        alignItems: "center",
        justifyContent: "center",
    },

    checkPillGhost: {
        width: 28,
        height: 28,
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
