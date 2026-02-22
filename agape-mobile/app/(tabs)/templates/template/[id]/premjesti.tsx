import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import NavigationHeader from "../../../../../components/NavigationHeader";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";

import { useTemplate, useTemplateFolders, useMoveTemplate } from "@/app/api/hooks/useDispatchTemplates";
import { FolderPicker } from "@/components/FolderPicker";

const MAX_W = 560;

export default function PremjestiPredlozak() {
    const params = useLocalSearchParams<{ id?: string; templateId?: string }>();
    const templateId = Number(params.id ?? params.templateId);
    const hasValidId = Number.isFinite(templateId) && templateId > 0;

    const tQ = useTemplate(templateId);
    const foldersQ = useTemplateFolders();
    const moveM = useMoveTemplate();

    const t = tQ.data as any;
    const folders = (foldersQ.data ?? []) as any[];

    const [targetFolderId, setTargetFolderId] = useState<number | null>(null);

    useEffect(() => {
        if (!t) return;
        const id = t.folderId == null ? null : Number(t.folderId);
        setTargetFolderId(Number.isFinite(id as any) ? (id as any) : null);
    }, [t?.id]);

    const currentLabel = useMemo(() => {
        if (!t) return "—";
        const id = t.folderId == null ? null : Number(t.folderId);
        if (id == null) return "Root (bez mape)";
        const f = folders.find((x) => Number(x.id) === id);
        return (f?.name ?? `Mapa #${id}`) as string;
    }, [t, folders]);

    const targetLabel = useMemo(() => {
        const id = targetFolderId == null ? null : Number(targetFolderId);
        if (id == null) return "Root (bez mape)";
        const f = folders.find((x) => Number(x.id) === id);
        return (f?.name ?? `Mapa #${id}`) as string;
    }, [targetFolderId, folders]);

    const err =
        (!hasValidId ? "Nedostaje parametar predloška (id)." : null) ||
        (tQ.error as any)?.message ||
        (foldersQ.error as any)?.message ||
        (moveM.error as any)?.message ||
        null;

    const canSubmit = hasValidId && !!t && !moveM.isPending;

    return (
        <Screen>
            <NavigationHeader
                title="Premjesti predložak"
                subtitle={hasValidId ? `#${templateId}` : "—"}
                fallbackHref="/(tabs)/templates"
            />

            <View style={s.container}>
                {!!err && <Banner type="error" text={err} />}

                {!hasValidId ? (
                    <Text style={s.loading}>Neispravan parametar.</Text>
                ) : !t ? (
                    <Text style={s.loading}>{tQ.isLoading ? "Učitavam…" : "Predložak nije pronađen."}</Text>
                ) : (
                    <View style={s.body}>
                        <View style={s.card}>
                            <Text style={s.title} numberOfLines={2}>
                                {t.name ?? `Predložak #${templateId}`}
                            </Text>
                            <Text style={s.sub}>Trenutno: {currentLabel}</Text>
                            <Text style={s.sub}>Odredište: {targetLabel}</Text>
                        </View>

                        {/* ✅ picker fills remaining space (scroll) */}
                        <View style={s.pickerWrap}>
                            <FolderPicker
                                fill
                                title="Odaberi odredišnu mapu"
                                folders={folders as any}
                                selectedId={targetFolderId}
                                onSelect={setTargetFolderId}
                                allowRoot
                                rootLabel="Root (bez mape)"
                            />
                        </View>

                        {/* ✅ actions docked to bottom */}
                        <View style={s.actions}>
                            <Pressable
                                style={[s.primary, !canSubmit && { opacity: 0.6 }]}
                                disabled={!canSubmit}
                                onPress={async () => {
                                    await moveM.mutateAsync({
                                        templateId,
                                        payload: { targetFolderId: targetFolderId as any },
                                    });
                                    router.back();
                                }}
                            >
                                <Text style={s.primaryText}>{moveM.isPending ? "Premještam…" : "Premjesti"}</Text>
                            </Pressable>

                            <Pressable
                                style={[s.secondary, moveM.isPending && { opacity: 0.6 }]}
                                onPress={() => router.back()}
                                disabled={moveM.isPending}
                            >
                                <Text style={s.secondaryText}>Odustani</Text>
                            </Pressable>
                        </View>
                    </View>
                )}
            </View>
        </Screen>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, padding: 14, gap: 12 },

    body: { flex: 1, minHeight: 0, gap: 12 },

    loading: { color: Colors.sub, fontWeight: "800", textAlign: "center", marginTop: 20 },

    card: {
        backgroundColor: Colors.bg,
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        padding: 14,
        gap: 6,
    },
    title: { fontWeight: "900", color: Colors.text, fontSize: 16 },
    sub: { color: Colors.sub, fontWeight: "800" },

    pickerWrap: { flex: 1, minHeight: 0 },

    actions: { marginTop: "auto", gap: 10, paddingBottom: 2 },

    primary: {
        alignSelf: "center",
        width: "100%",
        maxWidth: MAX_W,
        padding: 12,
        borderRadius: 14,
        backgroundColor: Colors.orange,
        alignItems: "center",
        justifyContent: "center",
    },
    primaryText: { color: "#fff", fontWeight: "900" },

    secondary: {
        alignSelf: "center",
        width: "100%",
        maxWidth: MAX_W,
        padding: 12,
        borderRadius: 14,
        backgroundColor: "rgba(148,163,184,0.18)",
        alignItems: "center",
        justifyContent: "center",
    },
    secondaryText: { fontWeight: "900", color: Colors.text },
});
