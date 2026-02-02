import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import TemplatesHeader from "../TemplatesHeader";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";

import { useTemplateFolders, useCopyFolderTree } from "@/app/api/hooks/useDispatchTemplates";
import { FolderPicker } from "@/components/FolderPicker";

const MAX_W = 560;

export default function KopirajMapu() {
    const params = useLocalSearchParams<{ folderId?: string; id?: string }>();
    const folderId = Number(params.folderId ?? params.id);

    const foldersQ = useTemplateFolders();
    const copyM = useCopyFolderTree();

    const folders = foldersQ.data ?? [];
    const me = useMemo(() => folders.find((f: any) => Number(f.id) === folderId) ?? null, [folders, folderId]);

    const [targetParentId, setTargetParentId] = useState<number | null>(null);
    const [includeSubfolders, setIncludeSubfolders] = useState(true);
    const [includeTemplates, setIncludeTemplates] = useState(true);

    useEffect(() => {
        if (!me) return;
        setTargetParentId((me.parentId ?? null) as any);
    }, [me?.id]);

    const excludeIds = useMemo(() => new Set<number>(Number.isFinite(folderId) ? [folderId] : []), [folderId]);

    const err =
        (Number.isFinite(folderId) ? null : "Nedostaje parametar mape (folderId).") ||
        (foldersQ.error as any)?.message ||
        (copyM.error as any)?.message ||
        null;

    return (
        <Screen>
            <TemplatesHeader title="Kopiraj mapu" subtitle={`#${folderId}`} fallbackHref="/(tabs)/templates" />

            <View style={s.container}>
                {!!err && <Banner type="error" text={err} />}

                {!me ? (
                    <Text style={s.loading}>Učitavam…</Text>
                ) : (
                    <>
                        <View style={s.card}>
                            <Text style={s.title} numberOfLines={2}>{me.name ?? `Mapa #${folderId}`}</Text>
                            <Text style={s.sub}>Odaberi gdje kopirati mapu i što uključiti.</Text>
                        </View>

                        <FolderPicker
                            title="Odaberi odredišnu nad-mapu"
                            folders={folders as any}
                            selectedId={targetParentId}
                            onSelect={setTargetParentId}
                            excludeIds={excludeIds}
                            allowRoot
                            rootLabel="Root (kopiraj u root)"
                        />

                        <View style={s.toggles}>
                            <Pressable
                                style={[s.toggle, includeSubfolders && s.toggleActive]}
                                onPress={() => setIncludeSubfolders(v => !v)}
                                disabled={copyM.isPending}
                            >
                                <Text style={[s.toggleText, includeSubfolders && s.toggleTextActive]}>
                                    Podmape: {includeSubfolders ? "DA" : "NE"}
                                </Text>
                            </Pressable>

                            <Pressable
                                style={[s.toggle, includeTemplates && s.toggleActive]}
                                onPress={() => setIncludeTemplates(v => !v)}
                                disabled={copyM.isPending}
                            >
                                <Text style={[s.toggleText, includeTemplates && s.toggleTextActive]}>
                                    Predlošci: {includeTemplates ? "DA" : "NE"}
                                </Text>
                            </Pressable>
                        </View>

                        <Pressable
                            style={[s.primary, copyM.isPending && { opacity: 0.6 }]}
                            disabled={copyM.isPending}
                            onPress={async () => {
                                await copyM.mutateAsync({
                                    folderId,
                                    payload: {
                                        targetParentId: targetParentId as any,
                                        includeSubfolders,
                                        includeTemplates,
                                    } as any,
                                });
                                router.back();
                            }}
                        >
                            <Text style={s.primaryText}>{copyM.isPending ? "Kopiram…" : "Kopiraj"}</Text>
                        </Pressable>

                        <Pressable style={s.secondary} onPress={() => router.back()} disabled={copyM.isPending}>
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

    toggles: { gap: 10 },
    toggle: {
        borderRadius: 14,
        padding: 12,
        backgroundColor: "rgba(148,163,184,0.18)",
        alignItems: "center",
        justifyContent: "center",
    },
    toggleActive: {
        backgroundColor: "rgba(249,115,22,0.18)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(249,115,22,0.35)",
    },
    toggleText: { fontWeight: "900", color: Colors.sub },
    toggleTextActive: { color: Colors.text },

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
