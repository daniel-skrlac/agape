// components/ValidateImpactModal.tsx
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Colors from "@/constants/Colors";

import type { BookingImpactItemDTO, WarehouseBookingImpactDTO } from "@/app/models/generated";

type Props = {
    visible: boolean;
    onClose: () => void;
    disableClose?: boolean;

    loading: boolean;
    error?: string | null;

    data: WarehouseBookingImpactDTO | null;

    onConfirm: () => void;
    confirmText?: string;
};

function toNum(v: any): number | null {
    if (v == null) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : null;
}

function fmt(v: any): string {
    const n = toNum(v);
    if (n == null) return "";
    return String(n);
}

type Status = "ok" | "warn" | "bad";

function badgeTone(kind: Status) {
    if (kind === "bad") return { bg: "rgba(239,68,68,0.12)", bd: "rgba(239,68,68,0.28)", tx: Colors.dangerText };
    if (kind === "warn") return { bg: "rgba(249,115,22,0.14)", bd: "rgba(249,115,22,0.30)", tx: Colors.text };
    return { bg: "rgba(34,197,94,0.14)", bd: "rgba(34,197,94,0.30)", tx: Colors.text };
}

function statusOfItem(it: any): Status {
    if (!!it?.missingInWarehouse) return "bad";
    const after = toNum(it?.afterEffectiveQty);
    if (after != null && after < 0) return "warn";
    return "ok";
}

function statusLabel(s: Status) {
    if (s === "bad") return "NEMA U SKLADIŠTU";
    if (s === "warn") return "IDE U MINUS";
    return "OK";
}

function modeTitle(data: any) {
    return data?.draft ? "Draft (neproknjiženo)" : "Final (proknjiženo)";
}

type FieldKey = "currentQty" | "pendingOutQty" | "pendingInQty" | "inQty" | "outQty";

const FIELD_META: Record<
    FieldKey,
    {
        title: string;
        beforeKey: string;
        afterKey: string;
    }
> = {
    currentQty: { title: "Trenutna zaliha", beforeKey: "beforeCurrentQty", afterKey: "afterCurrentQty" },
    pendingOutQty: { title: "Neproknjiženo (OUT)", beforeKey: "beforePendingOutQty", afterKey: "afterPendingOutQty" },
    pendingInQty: { title: "Neproknjiženo (IN)", beforeKey: "beforePendingInQty", afterKey: "afterPendingInQty" },
    inQty: { title: "Promet (IN)", beforeKey: "beforeInQty", afterKey: "afterInQty" },
    outQty: { title: "Promet (OUT)", beforeKey: "beforeOutQty", afterKey: "afterOutQty" },
};

function renderBeforeAfterRow(
    key: string,
    label: string,
    beforeVal: any,
    afterVal: any,
    emphasize?: boolean
) {
    return (
        <View key={key} style={s.rowCard}>
            <Text style={s.rowTitle}>{label}</Text>

            <View style={s.rowGrid}>
                <View style={s.rowCell}>
                    <Text style={s.rowLabel}>Prije</Text>
                    <Text style={s.rowValue}>{fmt(beforeVal)}</Text>
                </View>

                <View style={s.rowArrow}>
                    <FontAwesome name="arrow-right" size={14} color={Colors.sub} />
                </View>

                <View style={s.rowCell}>
                    <Text style={s.rowLabel}>Poslije</Text>
                    <Text style={[s.rowValue, emphasize && { color: Colors.text }]}>{fmt(afterVal)}</Text>
                </View>
            </View>
        </View>
    );
}

export default function ValidateImpactModal(props: Props) {
    const { visible, onClose, disableClose, loading, error, data, onConfirm, confirmText } = props;

    const [onlyChanges, setOnlyChanges] = useState(true);

    const items: any[] = ((data as any)?.items ?? []) as any[];

    const counts = useMemo(() => {
        let ok = 0,
            warn = 0,
            bad = 0;
        for (const it of items) {
            const s = statusOfItem(it);
            if (s === "ok") ok++;
            else if (s === "warn") warn++;
            else bad++;
        }
        return { ok, warn, bad, total: items.length };
    }, [items]);

    const canConfirm = !disableClose && !loading && !error && !!data && counts.bad === 0;

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={disableClose ? undefined : onClose}>
            <View style={s.wrap}>
                <Pressable style={s.backdrop} onPress={disableClose ? undefined : onClose} />

                <View style={s.card}>
                    <View style={s.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.title}>Provjera utjecaja na skladište</Text>
                            {!!data ? (
                                <Text style={s.subtitle}>
                                    {modeTitle(data as any)} • DOK: {String((data as any).documentCode ?? "")}
                                </Text>
                            ) : (
                                <Text style={s.subtitle}>Prije kreiranja provjeravamo očekivane promjene.</Text>
                            )}
                        </View>

                        <Pressable
                            style={[s.iconBtn, disableClose && { opacity: 0.5 }]}
                            onPress={disableClose ? undefined : onClose}
                            disabled={disableClose}
                        >
                            <FontAwesome name="close" size={18} color={Colors.text} />
                        </Pressable>
                    </View>

                    <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
                        {loading ? (
                            <View style={s.stateBox}>
                                <ActivityIndicator />
                                <Text style={s.stateTitle}>Provjeravam…</Text>
                                <Text style={s.stateSub}>Analiziram stavke i očekivane promjene.</Text>
                            </View>
                        ) : error ? (
                            <View style={s.errBox}>
                                <View style={s.errHeader}>
                                    <FontAwesome name="exclamation-triangle" size={16} color={Colors.dangerText} />
                                    <Text style={s.errTitle}>Validacija nije uspjela</Text>
                                </View>

                                <Text style={s.errText}>{error}</Text>

                                <Pressable style={s.secondary} onPress={onClose} disabled={disableClose}>
                                    <Text style={s.secondaryText}>Zatvori</Text>
                                </Pressable>
                            </View>
                        ) : !data ? (
                            <View style={s.stateBox}>
                                <Text style={s.stateTitle}>Nema podataka</Text>
                                <Text style={s.stateSub}>Pokreni validaciju kako bi vidio rezultat.</Text>
                            </View>
                        ) : (
                            <>
                                {/* Summary */}
                                <View style={s.summaryCard}>
                                    <View style={s.summaryRow}>
                                        <View style={s.summaryCell}>
                                            <Text style={s.summaryLabel}>Skladište</Text>
                                            <Text style={s.summaryValue}>{String((data as any).warehouseId ?? "")}</Text>
                                        </View>

                                        <View style={s.summaryCell}>
                                            <Text style={s.summaryLabel}>Stavki</Text>
                                            <Text style={s.summaryValue}>{String(counts.total)}</Text>
                                        </View>
                                    </View>

                                    <View style={s.kpiRow}>
                                        <View style={[s.kpiPill, { backgroundColor: "rgba(34,197,94,0.14)", borderColor: "rgba(34,197,94,0.30)" }]}>
                                            <Text style={s.kpiText}>OK: {counts.ok}</Text>
                                        </View>
                                        <View style={[s.kpiPill, { backgroundColor: "rgba(249,115,22,0.14)", borderColor: "rgba(249,115,22,0.30)" }]}>
                                            <Text style={s.kpiText}>U minus: {counts.warn}</Text>
                                        </View>
                                        <View style={[s.kpiPill, { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.28)" }]}>
                                            <Text style={s.kpiText}>Nema u skladištu: {counts.bad}</Text>
                                        </View>
                                    </View>

                                    {counts.warn > 0 ? (
                                        <View style={s.noticeWarn}>
                                            <FontAwesome name="warning" size={16} color={Colors.text} />
                                            <Text style={s.noticeWarnText}>Neke stavke idu u minus nakon promjene. Možeš nastaviti.</Text>
                                        </View>
                                    ) : (
                                        <View style={s.noticeOk}>
                                            <FontAwesome name="check" size={16} color={Colors.text} />
                                            <Text style={s.noticeOkText}>Sve izgleda u redu. Možeš kreirati dokument.</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Items */}
                                <View style={s.listHeader}>
                                    <Text style={s.listTitle}>Stavke</Text>
                                    <Text style={s.listSub}>Prikazujemo prije/poslije i samo polja koja su se stvarno promijenila.</Text>
                                </View>

                                <View style={{ gap: 10 }}>
                                    {items.map((it: any, idx: number) => {
                                        const st = statusOfItem(it);
                                        const tone = badgeTone(st);

                                        const itemId = it?.itemId ?? "x";
                                        const itemKey = `${itemId}-${idx}`; // safe even if duplicates

                                        const name = String(it?.name ?? "").trim();
                                        const code = String(it?.itemCode ?? "").trim();
                                        const unit = String(it?.unit ?? "").trim();
                                        const metaLine = [code ? `Šifra: ${code}` : null, unit ? `JMJ: ${unit}` : null].filter(Boolean).join(" • ");

                                        const changedFields: string[] = (it?.changedFields ?? []) as string[];

                                        const fieldCards: React.ReactNode[] = [];

                                        // effective always
                                        fieldCards.push(
                                            renderBeforeAfterRow(
                                                `${itemKey}-effective`,
                                                "Efektivno (dostupno)",
                                                it?.beforeEffectiveQty,
                                                it?.afterEffectiveQty,
                                                st !== "ok"
                                            )
                                        );

                                        // other fields
                                        (Object.keys(FIELD_META) as FieldKey[]).forEach((k) => {
                                            const meta = FIELD_META[k];
                                            const beforeVal = it?.[meta.beforeKey];
                                            const afterVal = it?.[meta.afterKey];

                                            const isChanged = changedFields.includes(k);
                                            const hasAnyValue = beforeVal != null || afterVal != null;

                                            const shouldShow = onlyChanges ? isChanged : hasAnyValue || isChanged;
                                            if (!shouldShow) return;

                                            fieldCards.push(
                                                renderBeforeAfterRow(`${itemKey}-${k}`, meta.title, beforeVal, afterVal)
                                            );
                                        });

                                        return (
                                            <View key={itemKey} style={s.itemCard}>
                                                <View style={s.itemTop}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={s.itemName} numberOfLines={2}>
                                                            {name}
                                                        </Text>
                                                        {!!metaLine && (
                                                            <Text style={s.itemMeta} numberOfLines={1}>
                                                                {metaLine}
                                                            </Text>
                                                        )}
                                                    </View>

                                                    <View style={[s.badge, { backgroundColor: tone.bg, borderColor: tone.bd }]}>
                                                        <Text style={[s.badgeText, { color: tone.tx }]}>{statusLabel(st)}</Text>
                                                    </View>
                                                </View>

                                                <View style={{ gap: 10 }}>{fieldCards}</View>
                                            </View>
                                        );
                                    })}
                                </View>

                                {/* Actions */}
                                <View style={{ gap: 10, marginTop: 6 }}>
                                    <Pressable style={[s.primary, !canConfirm && { opacity: 0.5 }]} onPress={onConfirm} disabled={!canConfirm}>
                                        <Text style={s.primaryText}>{counts.bad > 0 ? "Ne mogu kreirati" : confirmText ?? "Kreiraj"}</Text>
                                    </Pressable>

                                    <Pressable style={s.secondary} onPress={onClose} disabled={disableClose}>
                                        <Text style={s.secondaryText}>Zatvori</Text>
                                    </Pressable>
                                </View>
                            </>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    wrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },

    card: {
        width: "100%",
        maxWidth: 560,
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: Colors.bg,
        overflow: "hidden",
        maxHeight: "88%",
    },

    header: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },
    title: { fontWeight: "900", color: Colors.text, fontSize: 16, lineHeight: 20 },
    subtitle: { marginTop: 2, color: Colors.sub, fontWeight: "800", fontSize: 12, lineHeight: 16 },
    iconBtn: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: "rgba(148,163,184,0.18)",
        alignItems: "center",
        justifyContent: "center",
    },

    body: { padding: 14, gap: 12, paddingBottom: 18 },

    stateBox: {
        paddingVertical: 18,
        paddingHorizontal: 12,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    stateTitle: { fontWeight: "900", color: Colors.text, fontSize: 14 },
    stateSub: { fontWeight: "800", color: Colors.sub, fontSize: 12, textAlign: "center" },

    errBox: {
        padding: 12,
        borderRadius: 16,
        backgroundColor: Colors.dangerBg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.dangerText,
        gap: 10,
    },
    errHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    errTitle: { fontWeight: "900", color: Colors.dangerText, fontSize: 14 },
    errText: { fontWeight: "800", color: Colors.dangerText, opacity: 0.95 },

    summaryCard: {
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: "rgba(148,163,184,0.10)",
        padding: 12,
        gap: 10,
    },
    summaryRow: { flexDirection: "row", gap: 10 },
    summaryCell: {
        flex: 1,
        padding: 10,
        borderRadius: 14,
        backgroundColor: Colors.bg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        gap: 2,
    },
    summaryLabel: { color: Colors.sub, fontWeight: "800", fontSize: 12 },
    summaryValue: { color: Colors.text, fontWeight: "900", fontSize: 14 },

    kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    kpiPill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    kpiText: { fontWeight: "900", color: Colors.text, fontSize: 12 },

    togglePill: {
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: "rgba(148,163,184,0.18)",
    },
    toggleText: { fontWeight: "900", color: Colors.text, fontSize: 12 },

    noticeBad: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        padding: 10,
        borderRadius: 14,
        backgroundColor: "rgba(239,68,68,0.10)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(239,68,68,0.25)",
    },
    noticeBadText: { flex: 1, fontWeight: "900", color: Colors.dangerText, fontSize: 12, lineHeight: 16 },

    noticeWarn: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        padding: 10,
        borderRadius: 14,
        backgroundColor: "rgba(249,115,22,0.10)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(249,115,22,0.25)",
    },
    noticeWarnText: { flex: 1, fontWeight: "900", color: Colors.text, fontSize: 12, lineHeight: 16 },

    noticeOk: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        padding: 10,
        borderRadius: 14,
        backgroundColor: "rgba(34,197,94,0.10)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(34,197,94,0.22)",
    },
    noticeOkText: { flex: 1, fontWeight: "900", color: Colors.text, fontSize: 12, lineHeight: 16 },

    listHeader: { marginTop: 2, gap: 2 },
    listTitle: { fontWeight: "900", color: Colors.text, fontSize: 14 },
    listSub: { fontWeight: "800", color: Colors.sub, fontSize: 12 },

    itemCard: {
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: Colors.bg,
        padding: 12,
        gap: 10,
    },
    itemTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    itemName: { fontWeight: "900", color: Colors.text, fontSize: 15, lineHeight: 18 },
    itemMeta: { color: Colors.sub, fontWeight: "800", fontSize: 12, marginTop: 2 },

    badge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: "center",
        justifyContent: "center",
    },
    badgeText: { fontWeight: "900", fontSize: 11 },

    rowCard: {
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        backgroundColor: "rgba(148,163,184,0.08)",
        padding: 10,
        gap: 8,
    },
    rowTitle: { fontWeight: "900", color: Colors.text, fontSize: 13 },
    rowGrid: { flexDirection: "row", alignItems: "center", gap: 10 },
    rowCell: {
        flex: 1,
        padding: 10,
        borderRadius: 12,
        backgroundColor: Colors.bg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        gap: 2,
    },
    rowLabel: { color: Colors.sub, fontWeight: "800", fontSize: 12 },
    rowValue: { color: Colors.text, fontWeight: "900", fontSize: 14 },
    rowArrow: { width: 22, alignItems: "center", justifyContent: "center" },

    primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center" },
    primaryText: { color: "#fff", fontWeight: "900" },

    secondary: {
        padding: 12,
        borderRadius: 14,
        backgroundColor: "rgba(148,163,184,0.18)",
        alignItems: "center",
    },
    secondaryText: { fontWeight: "900", color: Colors.text },
});
