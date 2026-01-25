import React, { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";

import { partnerService } from "@/app/api/services/partnerService";
import { useBookMany, useBookOne } from "@/app/api/hooks/useDispatchTemplates";
import type { PartnerResponseDTO } from "@/app/models/generated";
import { Banner } from "@/components/Banner";
import { toLocalDateString } from "@/components/date";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";
import { Segmented } from "@/components/Segmented";
import { Sheet } from "@/components/Sheet";
import Colors from "@/constants/Colors";

type DraftMode = "POSTUJ_PREDLOZAK" | "SVE_SKICA" | "SVE_KONACNO";

export default function KreirajOtpremu() {
  const params = useLocalSearchParams<{ id: string }>();
  const templateId = Number(params.id);

  const bookOneM = useBookOne();
  const bookManyM = useBookMany();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<PartnerResponseDTO[]>([]);
  const [draftMode, setDraftMode] = useState<DraftMode>("POSTUJ_PREDLOZAK");

  const [resultOpen, setResultOpen] = useState(false);
  const [resultText, setResultText] = useState<string>("");

  const err = (bookOneM.error as any)?.message || (bookManyM.error as any)?.message || null;

  const togglePartner = (p: PartnerResponseDTO) => {
    const exists = selected.some(x => x.id === p.id);
    setSelected(exists ? selected.filter(x => x.id !== p.id) : [...selected, p]);
  };

  const draftOverride = draftMode === "POSTUJ_PREDLOZAK" ? null : draftMode === "SVE_SKICA";

  const submit = async () => {
    if (selected.length === 0) return;

    const documentDate = toLocalDateString(new Date()); // danas

    if (selected.length === 1) {
      const res = await bookOneM.mutateAsync({
        templateId,
        partnerId: selected[0].id,
        documentDate: documentDate as any,
        draftOverride: draftOverride as any,
      } as any);
      setResultText(`Uspješno: ${res.succeeded}/${res.total} • Neuspješno: ${res.failed}`);
      setResultOpen(true);
      return;
    }

    const res = await bookManyM.mutateAsync({
      templateId,
      partnerIds: selected.map(x => x.id),
      documentDate: documentDate as any,
      draftOverride: draftOverride as any,
    } as any);
    setResultText(`Uspješno: ${res.succeeded}/${res.total} • Neuspješno: ${res.failed}`);
    setResultOpen(true);
  };

  return (
    <Screen>
      <View style={s.container}>
        {!!err && <Banner type="error" text={err} />}

        <Pressable style={s.primary} onPress={() => setPickerOpen(true)}>
          <Text style={s.primaryText}>Odaberi partnere</Text>
        </Pressable>

        <Text style={s.label}>Način skice</Text>
        <Segmented<DraftMode>
          value={draftMode}
          options={[
            { value: "POSTUJ_PREDLOZAK", label: "Poštuj predložak" },
            { value: "SVE_SKICA", label: "Sve kao skica" },
            { value: "SVE_KONACNO", label: "Sve kao konačno" },
          ]}
          onChange={setDraftMode}
        />

        <Text style={s.label}>Odabrani partneri</Text>
        <FlatList
          data={selected}
          keyExtractor={(x) => String(x.id)}
          contentContainerStyle={{ gap: 10 }}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{item.name}</Text>
                <Text style={s.sub}>#{item.partnerNumber} • {item.city}</Text>
              </View>
              <Pressable style={s.remove} onPress={() => togglePartner(item)}>
                <Text style={s.removeText}>Ukloni</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={<Text style={s.empty}>Nema odabranih partnera.</Text>}
        />

        <Pressable style={[s.primary, (selected.length === 0) && { opacity: 0.5 }]} disabled={selected.length === 0} onPress={submit}>
          <Text style={s.primaryText}>Kreiraj</Text>
        </Pressable>

        <SearchPickerSheet<PartnerResponseDTO>
          visible={pickerOpen}
          title="Odaberi partnere"
          onClose={() => setPickerOpen(false)}
          keyOf={(p) => String(p.id)}
          fetchPage={async ({ page, size, q }) => {
            const res = await partnerService.pagePartners({ page, size, q });
            return { items: res.items, page: res.page, size: res.size, total: res.total };
          }}
          renderRow={(p, close) => (
            <Pressable
              style={[s.pickRow, selected.some(x => x.id === p.id) ? { borderColor: Colors.orange } : null]}
              onPress={() => togglePartner(p)}
            >
              <Text style={s.pickTitle}>{p.name}</Text>
              <Text style={s.pickSub}>#{p.partnerNumber} • {p.city}</Text>
            </Pressable>
          )}
        />

        <Sheet visible={resultOpen} title="Rezultat" onClose={() => setResultOpen(false)}>
          <Text style={{ fontWeight: "900", color: Colors.text }}>{resultText}</Text>
          <Pressable style={s.primary} onPress={() => setResultOpen(false)}>
            <Text style={s.primaryText}>OK</Text>
          </Pressable>
        </Sheet>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12 },
  label: { fontWeight: "900", color: Colors.text },

  primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },

  card: { backgroundColor: Colors.bg, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontWeight: "900", color: Colors.text },
  sub: { color: Colors.sub, fontWeight: "700" },
  remove: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: Colors.dangerBg },
  removeText: { fontWeight: "900", color: Colors.dangerText },
  empty: { textAlign: "center", color: Colors.sub, fontWeight: "800", marginTop: 12 },

  pickRow: { padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, backgroundColor: Colors.bg, gap: 4 },
  pickTitle: { fontWeight: "900", color: Colors.text },
  pickSub: { color: Colors.sub, fontWeight: "700" },
});
