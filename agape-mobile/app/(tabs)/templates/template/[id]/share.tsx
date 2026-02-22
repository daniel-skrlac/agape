import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import NavigationHeader from "../../../../../components/NavigationHeader";

import Colors from "@/constants/Colors";
import { ErrorCard } from "@/components/ErrorCard";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";
import { Segmented } from "@/components/Segmented";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";

import { toUserMessage } from "@/app/api/apiClient";
import { userDirectoryService, UserDirectoryItem } from "@/app/api/services/userDirectoryService";
import type { DispatchTemplateSharePermission, TemplateShareResponseDTO } from "@/app/models/generated";
import { useTemplateShares, useShareTemplate, useRevokeTemplateShare } from "@/app/api/hooks/templates/useDispatchTemplates";


type Perm = DispatchTemplateSharePermission;

type ConfirmShareState = {
  id: number;
  username?: string | null;
} | null;

export default function DijeliPredlozak() {
  const params = useLocalSearchParams<{ id?: string }>();

  const templateId = useMemo(() => {
    const n = Number(params.id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params.id]);

  const sharesQ = useTemplateShares(templateId);
  const shareM = useShareTemplate();
  const revokeM = useRevokeTemplateShare();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDirectoryItem | null>(null);
  const [perm, setPerm] = useState<Perm>("BOOK");

  const [confirmShare, setConfirmShare] = useState<ConfirmShareState>(null);

  const [screenError, setScreenError] = useState<string | null>(null);
  const [dismissedTopError, setDismissedTopError] = useState<string | null>(null);

  const resetTransientErrors = () => {
    setScreenError(null);
    setDismissedTopError(null);
    shareM.reset();
    revokeM.reset();
  };

  const closeTopError = () => {
    const currentRaw =
      screenError ||
      sharesQ.errorMessage ||
      (shareM.error ? toUserMessage(shareM.error, "Greška pri dijeljenju predloška.") : null) ||
      (revokeM.error ? toUserMessage(revokeM.error, "Greška pri uklanjanju dijeljenja.") : null) ||
      (!templateId ? "Neispravan ID predloška." : null);

    setScreenError(null);
    shareM.reset();
    revokeM.reset();
    setDismissedTopError(currentRaw ?? null);
  };

  const list = useMemo<TemplateShareResponseDTO[]>(() => {
    const raw: any = sharesQ.data;

    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    if (Array.isArray(raw?.data?.items)) return raw.data.items;
    if (Array.isArray(raw?.data)) return raw.data;

    return [];
  }, [sharesQ.data]);

  const rawTopError =
    screenError ||
    sharesQ.errorMessage ||
    (shareM.error ? toUserMessage(shareM.error, "Greška pri dijeljenju predloška.") : null) ||
    (revokeM.error ? toUserMessage(revokeM.error, "Greška pri uklanjanju dijeljenja.") : null) ||
    (!templateId ? "Neispravan ID predloška." : null);

  const topError = rawTopError && rawTopError !== dismissedTopError ? rawTopError : null;

  return (
    <Screen>
      <NavigationHeader
        title="Dijeli predložak"
        subtitle={templateId ? `Predložak #${templateId}` : "Predložak"}
        fallbackHref="/(tabs)/templates"
      />

      <View style={s.container}>
        {!!topError && (
          <ErrorCard
            title="Greška"
            message={topError}
            actionText="Zatvori"
            onAction={closeTopError}
            titleLines={1}
            messageLines={3}
          />
        )}

        <Pressable
          style={[s.primary, !templateId && s.disabled]}
          disabled={!templateId}
          onPress={() => {
            resetTransientErrors();
            setPickerOpen(true);
          }}
        >
          <Text style={s.primaryText}>Odaberi korisnika</Text>
        </Pressable>

        {selectedUser && (
          <View style={s.card}>
            <Text style={s.title}>{selectedUser.name || selectedUser.username}</Text>
            <Text style={s.sub}>@{selectedUser.username}</Text>

            <Text style={s.label}>Dozvola</Text>
            <Segmented<Perm>
              value={perm}
              options={[
                { value: "VIEW", label: "Pregled" },
                { value: "BOOK", label: "Kreiranje" },
              ]}
              onChange={setPerm}
            />

            <Pressable
              style={[s.primary, (shareM.isPending || !templateId) && s.disabled]}
              disabled={shareM.isPending || !templateId}
              onPress={async () => {
                try {
                  if (!templateId || !selectedUser?.username) return;

                  resetTransientErrors();

                  await shareM.mutateAsync({
                    templateId,
                    payload: {
                      username: selectedUser.username,
                      permission: perm,
                    } as any,
                  });

                  setSelectedUser(null);
                  await sharesQ.refetch();
                } catch (e) {
                  setScreenError(toUserMessage(e, "Greška pri dijeljenju predloška."));
                }
              }}
            >
              <Text style={s.primaryText}>{shareM.isPending ? "Dijelim…" : "Podijeli"}</Text>
            </Pressable>
          </View>
        )}

        <Text style={s.section}>Dijeljeno s</Text>

        <FlatList
          data={list}
          keyExtractor={(x) => String(x.id)}
          refreshing={sharesQ.isFetching}
          onRefresh={async () => {
            resetTransientErrors();
            await sharesQ.refetch();
          }}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={s.shareRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{item.sharedWithUsername || "—"}</Text>
                <Text style={s.sub}>
                  {item.permission === "BOOK" ? "Dozvola: Kreiranje" : "Dozvola: Pregled"}
                </Text>
              </View>

              <Pressable
                style={[s.dangerBtn, revokeM.isPending && s.disabled]}
                disabled={revokeM.isPending}
                onPress={() => {
                  resetTransientErrors();
                  setConfirmShare({
                    id: item.id,
                    username: item.sharedWithUsername,
                  });
                }}
              >
                <Text style={s.dangerText}>Ukloni</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <Text style={s.empty}>{sharesQ.isLoading ? "Učitavam…" : "Nema dijeljenja."}</Text>
          }
        />

        <SearchPickerSheet<UserDirectoryItem>
          visible={pickerOpen}
          title="Odaberi korisnika"
          onClose={() => setPickerOpen(false)}
          keyOf={(u) => String(u.id)}
          fetchPage={async ({ page, size, q }) => {
            const res = await userDirectoryService.pageUsers({ page, size, q });
            return {
              items: res.items ?? [],
              page: res.page ?? page,
              size: res.size ?? size,
              total: res.total ?? 0,
            };
          }}
          renderRow={(u, close) => (
            <Pressable
              style={s.pickRow}
              onPress={() => {
                resetTransientErrors();
                setSelectedUser(u);
                close();
              }}
            >
              <Text style={s.pickTitle}>{u.name || u.username}</Text>
              <Text style={s.pickSub}>@{u.username}</Text>
            </Pressable>
          )}
        />

        <CenterConfirmSheet
          visible={!!confirmShare}
          title="Ukloniti dijeljenje?"
          description={confirmShare?.username ? `@${confirmShare.username}` : "Ova akcija se ne može poništiti."}
          confirmText="Ukloni"
          danger
          loading={revokeM.isPending}
          onClose={() => setConfirmShare(null)}
          onConfirm={async () => {
            try {
              if (!templateId || !confirmShare?.id) return;

              resetTransientErrors();

              await revokeM.mutateAsync({ templateId, shareId: confirmShare.id });

              setConfirmShare(null);
              await sharesQ.refetch();
            } catch (e) {
              setScreenError(toUserMessage(e, "Greška pri uklanjanju dijeljenja."));
            }
          }}
        />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12 },

  section: { fontWeight: "900", color: Colors.text, marginTop: 4 },
  label: { fontWeight: "900", color: Colors.text },

  primary: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  card: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },

  title: { fontWeight: "900", color: Colors.text },
  sub: { color: Colors.sub, fontWeight: "700" },

  shareRow: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  dangerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Colors.dangerBg,
  },
  dangerText: { fontWeight: "900", color: Colors.dangerText },

  pickRow: {
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    gap: 4,
  },
  pickTitle: { fontWeight: "900", color: Colors.text },
  pickSub: { color: Colors.sub, fontWeight: "700" },

  empty: {
    textAlign: "center",
    color: Colors.sub,
    fontWeight: "800",
    marginTop: 18,
  },

  disabled: {
    opacity: 0.6,
  },
});