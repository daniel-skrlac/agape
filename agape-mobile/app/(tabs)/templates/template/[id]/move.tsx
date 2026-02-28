import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import NavigationHeader from "../../../../../components/NavigationHeader";
import Colors from "@/src/constants/Colors";

import { ErrorCard } from "@/components/ErrorCard";
import { FolderPicker } from "@/components/FolderPicker";

import { toUserMessage } from "../../../../../src/api/apiClient";
import {
    useMoveTemplate,
    useTemplateDetail,
    useTemplateFolderTree,
} from "../../../../../src/api/hooks/templates/useDispatchTemplates";

const MAX_W = 560;

type Mode = "SVE" | "MOJI" | "DIJELJENI";

function readNumberParam(params: any, keys: string[]): number {
    for (const key of keys) {
        const raw = params?.[key];
        if (raw == null) continue;

        const value = Array.isArray(raw) ? raw[0] : raw;
        const n = Number(value);

        if (Number.isFinite(n)) return n;
    }

    return NaN;
}

function readStringParam(v: unknown): string | null {
    const raw = Array.isArray(v) ? v[0] : v;
    const s = String(raw ?? "").trim();
    return s ? s : null;
}

function readNullableNumberParam(v: unknown): number | null {
    const raw = Array.isArray(v) ? v[0] : v;
    if (raw == null) return null;

    const s = String(raw).trim();
    if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return null;

    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

function readModeParam(v: unknown): Mode {
    const raw = Array.isArray(v) ? v[0] : v;
    const s = String(raw ?? "").trim().toUpperCase();
    if (s === "MOJI" || s === "DIJELJENI") return s;
    return "SVE";
}

export default function MoveTemplateScreen() {
    const params = useLocalSearchParams<{
        id?: string | string[];
        templateId?: string | string[];
        folderId?: string | string[];
        folderName?: string | string[];
        mode?: string | string[];
    }>();

    const templateId = readNumberParam(params, ["id", "templateId"]);
    const hasValidId = Number.isFinite(templateId) && templateId > 0;

    const routeFolderId = readNullableNumberParam(params.folderId);
    const routeFolderName = readStringParam(params.folderName) ?? "Mapa";
    const routeMode = readModeParam(params.mode);

    const backHref = useMemo(() => {
        if (hasValidId) {
            return {
                pathname: "/(tabs)/templates/template/[id]" as const,
                params: {
                    id: String(templateId),
                    folderId: routeFolderId == null ? "null" : String(routeFolderId),
                    folderName: routeFolderName,
                    mode: routeMode,
                },
            };
        }

        return "/(tabs)/templates" as const;
    }, [hasValidId, templateId, routeFolderId, routeFolderName, routeMode]);

    const templateQuery = useTemplateDetail(hasValidId ? templateId : null);
    const folderTreeQuery = useTemplateFolderTree({ enabled: hasValidId });
    const moveMutation = useMoveTemplate();

    const template = templateQuery.data as any;
    const folders = (folderTreeQuery.data ?? []) as any[];

    const [targetFolderId, setTargetFolderId] = useState<number | null>(null);

    useEffect(() => {
        if (!template) return;

        const currentFolderId = template.folderId == null ? null : Number(template.folderId);
        setTargetFolderId(Number.isFinite(currentFolderId as any) ? (currentFolderId as any) : null);
    }, [template?.id, template?.folderId]);

    const currentFolderLabel = useMemo(() => {
        if (!template) return "—";

        const currentId = template.folderId == null ? null : Number(template.folderId);
        if (currentId == null) return "Root (bez mape)";

        const folder = folders.find((x) => Number((x as any)?.id) === currentId);
        return String((folder as any)?.name ?? `Mapa #${currentId}`);
    }, [template, folders]);

    const targetFolderLabel = useMemo(() => {
        if (targetFolderId == null) return "Root (bez mape)";

        const folder = folders.find((x) => Number((x as any)?.id) === Number(targetFolderId));
        return String((folder as any)?.name ?? `Mapa #${Number(targetFolderId)}`);
    }, [targetFolderId, folders]);

    const topError = useMemo(() => {
        if (!hasValidId) return "Nedostaje parametar predloška (id).";

        if (templateQuery.error) {
            return toUserMessage(templateQuery.error, "Greška prilikom učitavanja predloška.");
        }

        if (folderTreeQuery.error) {
            return toUserMessage(folderTreeQuery.error, "Greška prilikom učitavanja mapa.");
        }

        if (moveMutation.error) {
            return toUserMessage(moveMutation.error, "Greška prilikom premještanja predloška.");
        }

        return null;
    }, [hasValidId, templateQuery.error, folderTreeQuery.error, moveMutation.error]);

    const sameTarget = useMemo(() => {
        if (!template) return false;

        const currentId = template.folderId == null ? null : Number(template.folderId);
        const a = currentId == null ? null : Number(currentId);
        const b = targetFolderId == null ? null : Number(targetFolderId);

        return a === b;
    }, [template, targetFolderId]);

    const canSubmit = useMemo(() => {
        return (
            hasValidId &&
            !!template &&
            !templateQuery.isLoading &&
            !folderTreeQuery.isLoading &&
            !moveMutation.isPending &&
            !sameTarget
        );
    }, [
        hasValidId,
        template,
        templateQuery.isLoading,
        folderTreeQuery.isLoading,
        moveMutation.isPending,
        sameTarget,
    ]);

    const handleRetry = async () => {
        moveMutation.reset();

        if (!hasValidId) return;

        await Promise.allSettled([Promise.resolve(templateQuery.refetch()), Promise.resolve(folderTreeQuery.refetch())]);
    };

    const handleMove = async () => {
        if (!hasValidId || !template || moveMutation.isPending) return;

        try {
            await moveMutation.mutateAsync({
                templateId,
                payload: { targetFolderId: targetFolderId as any },
            });

            router.replace({
                pathname: "/(tabs)/templates/template/[id]" as const,
                params: {
                    id: String(templateId),
                    folderId: routeFolderId == null ? "null" : String(routeFolderId),
                    folderName: routeFolderName,
                    mode: routeMode,
                },
            });
        } catch {
        }
    };

    const showLoading =
        hasValidId &&
        (templateQuery.isLoading || folderTreeQuery.isLoading) &&
        !template &&
        folders.length === 0;

    return (
        <Screen>
            <NavigationHeader
                title="Premjesti predložak"
                subtitle={hasValidId ? `#${templateId}` : "—"}
                fallbackHref={backHref}
            />

            <View style={s.page}>
                {!!topError && (
                    <ErrorCard
                        title="Greška"
                        message={topError}
                        actionText="Pokušaj ponovno"
                        onAction={handleRetry}
                        titleLines={1}
                        messageLines={3}
                    />
                )}

                {!hasValidId ? (
                    <Text style={s.loading}>Neispravan parametar.</Text>
                ) : showLoading ? (
                    <View style={s.centerBlock}>
                        <ActivityIndicator />
                        <Text style={s.loading}>Učitavam…</Text>
                    </View>
                ) : !template ? (
                    <Text style={s.loading}>{templateQuery.isFetching ? "Učitavam…" : "Predložak nije pronađen."}</Text>
                ) : (
                    <>
                        <View style={s.card}>
                            <Text style={s.title} numberOfLines={2}>
                                {String(template.name ?? `Predložak #${templateId}`)}
                            </Text>

                            <Text style={s.sub}>Trenutno: {currentFolderLabel}</Text>
                            <Text style={s.sub}>Odredište: {targetFolderLabel}</Text>

                            {sameTarget && (
                                <Text style={s.helper}>
                                    Predložak je već u odabranoj mapi. Odaberi drugu mapu ili Root.
                                </Text>
                            )}
                        </View>

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

                        <View style={s.footer}>
                            <Pressable
                                style={[s.primary, (!canSubmit || moveMutation.isPending) && s.disabled]}
                                disabled={!canSubmit || moveMutation.isPending}
                                onPress={handleMove}
                            >
                                <Text style={s.primaryText}>{moveMutation.isPending ? "Premještam…" : "Premjesti"}</Text>
                            </Pressable>

                            <Pressable
                                style={[s.secondary, moveMutation.isPending && s.disabled]}
                                disabled={moveMutation.isPending}
                                onPress={() => router.back()}
                            >
                                <Text style={s.secondaryText}>Odustani</Text>
                            </Pressable>
                        </View>
                    </>
                )}
            </View>
        </Screen>
    );
}

const s = StyleSheet.create({
    page: {
        flex: 1,
        minHeight: 0,
        padding: 14,
        gap: 12,
    },

    centerBlock: {
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 8,
    },

    loading: {
        color: Colors.sub,
        fontWeight: "800",
        textAlign: "center",
        marginTop: 8,
    },

    card: {
        backgroundColor: Colors.bg,
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        padding: 14,
        gap: 6,
    },

    title: {
        fontWeight: "900",
        color: Colors.text,
        fontSize: 16,
    },

    sub: {
        color: Colors.sub,
        fontWeight: "800",
    },

    helper: {
        marginTop: 4,
        color: Colors.sub,
        fontWeight: "700",
        fontSize: 12,
    },

    pickerWrap: {
        flex: 1,
        minHeight: 0,
    },

    footer: {
        gap: 10,
    },

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

    primaryText: {
        color: "#fff",
        fontWeight: "900",
    },

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

    secondaryText: {
        fontWeight: "900",
        color: Colors.text,
    },

    disabled: {
        opacity: 0.6,
    },
});