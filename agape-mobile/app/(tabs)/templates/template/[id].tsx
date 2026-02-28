import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import { Banner } from "@/components/Banner";
import Colors from "@/src/constants/Colors";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";
import NavigationHeader from "../../../../components/NavigationHeader";
import {
  useTemplateDetail,
  useDeleteTemplate,
  canEditDeleteTemplate,
} from "../../../../src/api/hooks/templates/useDispatchTemplates";

type Mode = "SVE" | "MOJI" | "DIJELJENI";

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

export default function PredlozakDetalji() {
  const params = useLocalSearchParams<{
    id: string;
    folderId?: string;
    folderName?: string;
    mode?: string;
  }>();

  const id = Number(params.id);

  const tQ = useTemplateDetail(id);
  const delM = useDeleteTemplate();

  const [confirmDel, setConfirmDel] = useState(false);

  const t = tQ.data;
  const err = (tQ.error as any)?.message || (delM.error as any)?.message || null;

  const routeFolderId = readNullableNumberParam(params.folderId);
  const routeFolderName = readStringParam(params.folderName);
  const routeMode = readModeParam(params.mode);

  const fromDtoFolderId = Number((t as any)?.folderId ?? NaN);
  const fromDtoNestedFolderId = Number((t as any)?.folder?.id ?? NaN);

  const templateFolderId =
    routeFolderId ??
    (Number.isFinite(fromDtoFolderId) ? fromDtoFolderId : null) ??
    (Number.isFinite(fromDtoNestedFolderId) ? fromDtoNestedFolderId : null);

  const normalizedTemplateFolderId =
    templateFolderId != null && Number.isFinite(templateFolderId) && templateFolderId > 0
      ? templateFolderId
      : null;

  const templateFolderName =
    routeFolderName ||
    String((t as any)?.folderName ?? "").trim() ||
    String((t as any)?.folder?.name ?? "").trim() ||
    "Mapa";

  const backHref = useMemo(() => {
    if (normalizedTemplateFolderId) {
      return {
        pathname: "/(tabs)/templates/folder/[folderId]" as const,
        params: {
          folderId: String(normalizedTemplateFolderId),
          folderName: templateFolderName,
          mode: routeMode,
        },
      };
    }

    return "/(tabs)/templates" as const;
  }, [normalizedTemplateFolderId, templateFolderName, routeMode]);

  const backAfterDelete = () => {
    if (normalizedTemplateFolderId) {
      router.replace({
        pathname: "/(tabs)/templates/folder/[folderId]" as const,
        params: {
          folderId: String(normalizedTemplateFolderId),
          folderName: templateFolderName,
          mode: routeMode,
        },
      });
      return;
    }

    router.replace({ pathname: "/(tabs)/templates" });
  };

  const canEditDelete = canEditDeleteTemplate({
    shared: !!t?.shared,
    sharedPermission: (t as any)?.sharedPermission ?? null,
  });

  return (
    <Screen>
      <NavigationHeader
        title="Predložak"
        subtitle={t?.name ? t.name : `#${id}`}
        fallbackHref={backHref}
      />

      <View style={s.container}>
        {!!err && <Banner type="error" text={err} />}

        {!t ? (
          <Text style={s.loading}>Učitavam…</Text>
        ) : (
          <>
            <View
              style={[
                s.card,
                t.shared ? { backgroundColor: Colors.sharedBg, borderColor: Colors.sharedBorder } : null,
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={s.title}>{t.name}</Text>
                {t.shared ? <Text style={s.badge}>DIJELJENO</Text> : null}
              </View>

              {typeof t.householdSize === "number" ? (
                <Text style={s.sub}>Kućanstvo: {t.householdSize}</Text>
              ) : null}

              {!!t.description ? <Text style={s.desc}>{t.description}</Text> : null}

              {normalizedTemplateFolderId ? (
                <Text style={s.sub}>Mapa: {templateFolderName}</Text>
              ) : (
                <Text style={s.sub}>Root</Text>
              )}
            </View>

            <View style={s.grid}>
              {canEditDelete ? (
                <ActionCard
                  icon="pencil"
                  label="Uredi"
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/templates/template/[id]/edit",
                      params: { id: String(id) },
                    })
                  }
                />
              ) : null}

              <ActionCard
                icon="file-text-o"
                label="Dokumenti"
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/templates/template/[id]/documents",
                    params: { id: String(id) },
                  })
                }
              />

              {canEditDelete ? (
                <ActionCard
                  icon="share-alt"
                  label="Dijeli"
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/templates/template/[id]/share",
                      params: { id: String(id) },
                    })
                  }
                />
              ) : null}

              <ActionCard
                icon="truck"
                label="Kreiraj otpremu"
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/templates/template/[id]/dispatch",
                    params: { id: String(id) },
                  })
                }
              />
            </View>

            {canEditDelete ? (
              <>
                <Pressable style={s.danger} onPress={() => setConfirmDel(true)}>
                  <FontAwesome name="trash" size={14} color={Colors.dangerText} />
                  <Text style={s.dangerText}>Obriši predložak</Text>
                </Pressable>

                <CenterConfirmSheet
                  visible={confirmDel}
                  title="Obrisati predložak?"
                  description={t?.name}
                  danger
                  confirmText="Obriši"
                  loading={delM.isPending}
                  onClose={() => setConfirmDel(false)}
                  onConfirm={async () => {
                    await delM.mutateAsync(id);
                    setConfirmDel(false);
                    backAfterDelete();
                  }}
                />
              </>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

function ActionCard({
  icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={s.action} onPress={onPress}>
      <View style={s.actionIcon}>
        <FontAwesome name={icon} size={16} color={Colors.text} />
      </View>
      <Text style={s.actionText}>{label}</Text>
      <FontAwesome name="chevron-right" size={14} color={Colors.sub} />
    </Pressable>
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
  title: { fontSize: 18, fontWeight: "900", color: Colors.text },
  badge: {
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.sharedBg,
    color: Colors.sharedText,
  },
  sub: { color: Colors.sub, fontWeight: "800" },
  desc: { color: Colors.text, fontWeight: "600" },

  grid: { gap: 10 },
  action: {
    backgroundColor: Colors.bg,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { flex: 1, fontWeight: "900", color: Colors.text },

  danger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: Colors.dangerBg,
  },
  dangerText: { fontWeight: "900", color: Colors.dangerText },
});