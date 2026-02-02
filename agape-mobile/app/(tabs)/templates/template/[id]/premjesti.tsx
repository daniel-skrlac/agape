import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import TemplatesHeader from "../../TemplatesHeader";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";

import { useTemplate, useTemplateFolders, useMoveTemplate } from "@/app/api/hooks/useDispatchTemplates";
import { FolderPicker } from "@/components/FolderPicker";

const MAX_W = 560;

export default function PremjestiPredlozak() {
    const params = useLocalSearchParams<{ id?: string; templateId?: string }>();
    const templateId = Number(params.id ?? params.templateId);

    const tQ = useTemplate(templateId);
    const foldersQ = useTemplateFolders();
    const moveM = useMoveTemplate();

    const t = tQ.data;
    const folders = foldersQ.data ?? [];

    const [targetFolderId, setTargetFolderId] = useState<number | null>(null);

    useEffect(() => {
        if (!t) return;
        setTargetFolderId((t.folderId ?? null) as any);
    }, [t?.id]);

    const currentLabel = useMemo(() => {
        if (!t) return "—";
        const id = t.folderId == null ? null : Number(t.folderId);
        if (id == null) return "Root (bez mape)";
        const f = folders.find((x: any) => Number(x.id) === id);
        return (f as any)?.name ?? `Mapa #${id}`;
    }, [t, folders]);

    const targetLabel = useMemo(() => {
        const id = targetFolderId == null ? null : Number(targetFolderId);
        if (id == null) return "Root (bez mape)";
        const f = folders.find((x: any) => Number(x.id) === id);
        return (f as any)?.name ?? `Mapa #${id}`;
    }, [targetFolderId, folders]);

    const err =
        (Number.isFinite(templateId) ? null : "Nedostaje parametar predloška (id).") ||
        (tQ.error as any)?.message ||
        (foldersQ.error as any)?.message ||
        (moveM.error as any)?.message ||
        null;

    return (
        <Screen>
            <TemplatesHeader title="Premjesti predložak" subtitle={`#${templateId}`} fallbackHref="/(tabs)/templates" />

            <View style={s.container}>
                {!!err && <Banner type="error" text={err} />}

                {!t ? (
                    <Text style={s.loading}>Učitavam…</Text>
                ) : (
                    <>
                        <View style={s.card}>
                            <Text style={s.title} numberOfLines={2}>{t.name ?? `Predložak #${templateId}`}</Text>
                            <Text style={s.sub}>Trenutno: {currentLabel}</Text>
                            <Text style={s.sub}>Odredište: {targetLabel}</Text>
                        </View>

                        <FolderPicker
                            title="Odaberi odredišnu mapu"
                            folders={folders as any}
                            selectedId={targetFolderId}
                            onSelect={setTargetFolderId}
                            allowRoot
                            rootLabel="Root (bez mape)"
                        />

                        <Pressable
                            style={[s.primary, moveM.isPending && { opacity: 0.6 }]}
                            disabled={moveM.isPending}
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

                        <Pressable style={s.secondary} onPress={() => router.back()} disabled={moveM.isPending}>
                            <Text style={s.secondaryText}>Odustani</Text>
                        </Pressable>
                    </>
                )}
            </View>
        </Screen>
    );
}

const s = StyleSheet.create({
    container: { padding: 14, gap: 12 },
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
