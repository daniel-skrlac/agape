import React, { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";

import { userDirectoryService, UserDirectoryItem } from "@/app/api/services/userDirectoryService";
import { useRevokeShare, useShare, useShares } from "@/app/api/hooks/useDispatchTemplates";
import type { DispatchTemplateSharePermission } from "@/app/models/generated";
import { Banner } from "@/components/Banner";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";
import { Segmented } from "@/components/Segmented";
import { Sheet } from "@/components/Sheet";
import Colors from "@/constants/Colors";
import TemplatesHeader from "../../TemplatesHeader";

type Perm = DispatchTemplateSharePermission;

export default function DijeliPredlozak() {
  const params = useLocalSearchParams<{ id: string }>();
  const templateId = Number(params.id);

  const sharesQ = useShares(templateId);
  const shareM = useShare(templateId);
  const revokeM = useRevokeShare(templateId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDirectoryItem | null>(null);
  const [perm, setPerm] = useState<Perm>("BOOK");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmShareId, setConfirmShareId] = useState<number | null>(null);

  const err =
    (sharesQ.error as any)?.message ||
    (shareM.error as any)?.message ||
    (revokeM.error as any)?.message ||
    null;

  const list = sharesQ.data ?? [];

  return (
    <Screen>
       <TemplatesHeader title="Dokumenti" subtitle={`Predložak #${templateId}`} />
      <View style={s.container}>
        {!!err && <Banner type="error" text={err} />}

        <Pressable style={s.primary} onPress={() => setPickerOpen(true)}>
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
              style={[s.primary, shareM.isPending && { opacity: 0.6 }]}
              disabled={shareM.isPending}
              onPress={async () => {
                await shareM.mutateAsync({ username: selectedUser.username, permission: perm } as any);
                setSelectedUser(null);
                sharesQ.refetch();
              }}
            >
              <Text style={s.primaryText}>Podijeli</Text>
            </Pressable>
          </View>
        )}

        <Text style={s.section}>Dijeljeno s</Text>
        <FlatList
          data={list}
          keyExtractor={(x) => String(x.id)}
          refreshing={sharesQ.isFetching}
          onRefresh={() => sharesQ.refetch()}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={s.shareRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{item.sharedWithUsername}</Text>
                <Text style={s.sub}>{item.permission === "BOOK" ? "Kreiranje" : "Pregled"}</Text>
              </View>
              <Pressable
                style={s.dangerBtn}
                onPress={() => {
                  setConfirmShareId(item.id);
                  setConfirmOpen(true);
                }}
              >
                <Text style={s.dangerText}>Ukloni</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={<Text style={s.empty}>Nema dijeljenja.</Text>}
        />

        <SearchPickerSheet<UserDirectoryItem>
          visible={pickerOpen}
          title="Odaberi korisnika"
          onClose={() => setPickerOpen(false)}
          keyOf={(u) => String(u.id)}
          fetchPage={async ({ page, size, q }) => {
            // backend excludes self by default
            const res = await userDirectoryService.pageUsers({ page, size, q });
            return { items: res.items, page: res.page, size: res.size, total: res.total };
          }}
          renderRow={(u, close) => (
            <Pressable
              style={s.pickRow}
              onPress={() => {
                setSelectedUser(u);
                close();
              }}
            >
              <Text style={s.pickTitle}>{u.name || u.username}</Text>
              <Text style={s.pickSub}>@{u.username}</Text>
            </Pressable>
          )}
        />

        <Sheet visible={confirmOpen} title="Ukloniti dijeljenje?" onClose={() => setConfirmOpen(false)}>
          <Pressable
            style={[s.primary, { backgroundColor: Colors.dangerBg }]}
            onPress={async () => {
              if (!confirmShareId) return;
              await revokeM.mutateAsync(confirmShareId);
              setConfirmOpen(false);
              sharesQ.refetch();
            }}
          >
            <Text style={[s.primaryText, { color: Colors.dangerText }]}>Ukloni</Text>
          </Pressable>
          <Pressable style={s.btn} onPress={() => setConfirmOpen(false)}>
            <Text style={s.btnText}>Odustani</Text>
          </Pressable>
        </Sheet>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12 },
  section: { fontWeight: "900", color: Colors.text, marginTop: 4 },
  label: { fontWeight: "900", color: Colors.text },

  primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center" },
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
  dangerBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: Colors.dangerBg },
  dangerText: { fontWeight: "900", color: Colors.dangerText },

  btn: { padding: 12, borderRadius: 14, backgroundColor: "rgba(148,163,184,0.18)", alignItems: "center" },
  btnText: { fontWeight: "900", color: Colors.text },

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
  empty: { textAlign: "center", color: Colors.sub, fontWeight: "800", marginTop: 18 },
});
