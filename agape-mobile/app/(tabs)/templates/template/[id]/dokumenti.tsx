import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import { documentDirectoryService } from "@/app/api/services/documentDirectoryService";
import type { DocumentDescriptorResponseDTO, TemplateDocResponseDTO, TemplateItemUpsertRequestDTO } from "@/app/models/generated";
import { useTemplate, useUpsertDoc, useReplaceItems } from "@/app/api/hooks/useDispatchTemplates";
import { Banner } from "@/components/Banner";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";
import { Sheet } from "@/components/Sheet";
import Colors from "@/constants/Colors";

export default function Dokumenti() {
  const params = useLocalSearchParams<{ id: string }>();
  const templateId = Number(params.id);

  const tQ = useTemplate(templateId);
  const upsertDocM = useUpsertDoc();
  const replaceItemsM = useReplaceItems();

  const t = tQ.data;
  const docs = t?.documents ?? [];

  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [editDocOpen, setEditDocOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<TemplateDocResponseDTO | null>(null);

  const [draft, setDraft] = useState(true);
  const [note, setNote] = useState("");

  const [itemsOpen, setItemsOpen] = useState(false);
  const [itemsDoc, setItemsDoc] = useState<TemplateDocResponseDTO | null>(null);

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");

  const err = (tQ.error as any)?.message || (upsertDocM.error as any)?.message || (replaceItemsM.error as any)?.message || null;

  const openEditDoc = (d: TemplateDocResponseDTO) => {
    setEditDoc(d);
    setDraft(!!d.draft);
    setNote(d.defaultNote ?? "");
    setEditDocOpen(true);
  };

  const openItems = (d: TemplateDocResponseDTO) => {
    setItemsDoc(d);
    setItemsOpen(true);
  };

  const addItem = () => {
    if (!itemsDoc) return;
    const id = Number(itemId);
    const qn = Number(qty);
    if (!Number.isFinite(id) || id <= 0) return;
    if (!Number.isFinite(qn) || qn <= 0) return;

    const current = (itemsDoc.items ?? []).map(i => ({ itemId: i.itemId, quantity: i.quantity, sortOrder: i.sortOrder }));
    current.push({ itemId: id, quantity: qn as any, sortOrder: current.length + 1 });

    const newDoc = { ...itemsDoc, items: current as any };
    setItemsDoc(newDoc);
    setItemId("");
    setQty("");
    setAddItemOpen(false);
  };

  const removeItem = (idx: number) => {
    if (!itemsDoc) return;
    const arr = [...(itemsDoc.items ?? [])];
    arr.splice(idx, 1);
    // re-sortOrder
    const fixed = arr.map((x, i) => ({ ...x, sortOrder: i + 1 }));
    setItemsDoc({ ...itemsDoc, items: fixed as any });
  };

  const saveItems = async () => {
    if (!itemsDoc) return;

    const payload: TemplateItemUpsertRequestDTO[] = (itemsDoc.items ?? []).map((x, i) => ({
      itemId: x.itemId,
      quantity: x.quantity,
      sortOrder: i + 1,
    })) as any;

    await replaceItemsM.mutateAsync({
      templateId,
      docId: itemsDoc.id,
      items: payload,
    });
    setItemsOpen(false);
    tQ.refetch();
  };

  return (
    <Screen>
      <View style={s.container}>
        {!!err && <Banner type="error" text={err} />}

        {!t ? (
          <Text style={s.loading}>Učitavam…</Text>
        ) : (
          <>
            <Pressable style={s.primary} onPress={() => setDocPickerOpen(true)}>
              <FontAwesome name="plus" size={14} color="#fff" />
              <Text style={s.primaryText}>Dodaj dokument</Text>
            </Pressable>

            <FlatList
              data={docs}
              keyExtractor={(d) => String(d.id)}
              contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
              renderItem={({ item }) => (
                <View style={s.card}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={s.title}>Dokument #{item.documentId}</Text>
                    <Text style={s.sub}>{item.draft ? "Skica" : "Konačno"}</Text>
                  </View>
                  {!!item.defaultNote && <Text style={s.desc} numberOfLines={2}>{item.defaultNote}</Text>}
                  <Text style={s.desc}>Stavki: {item.items?.length ?? 0}</Text>

                  <View style={s.row}>
                    <Pressable style={s.btn} onPress={() => openEditDoc(item)}>
                      <Text style={s.btnText}>Uredi</Text>
                    </Pressable>
                    <Pressable style={s.btn} onPress={() => openItems(item)}>
                      <Text style={s.btnText}>Stavke</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={s.empty}>Nema dokumenata u predlošku.</Text>}
            />

            {/* PICK DOCUMENT TYPE */}
            <SearchPickerSheet<DocumentDescriptorResponseDTO>
              visible={docPickerOpen}
              title="Odaberi dokument"
              onClose={() => setDocPickerOpen(false)}
              keyOf={(x) => String(x.documentId)}
              fetchPage={async ({ page, size, q }) => {
                const res = await documentDirectoryService.pageDocTypes({ page, size, q });
                return { items: res.items, page: res.page, size: res.size, total: res.total };
              }}
              renderRow={(d, close) => (
                <Pressable
                  style={s.pickRow}
                  onPress={async () => {
                    const sortOrder = (docs.length + 1); // auto
                    await upsertDocM.mutateAsync({
                      templateId,
                      payload: {
                        documentId: d.documentId,
                        sortOrder,
                        draft: true,
                        defaultNote: "",
                      } as any,
                    });
                    close();
                    tQ.refetch();
                  }}
                >
                  <Text style={s.pickTitle}>{d.displayName}</Text>
                  <Text style={s.pickSub}>Šifra: {d.documentCode} • ID: {d.documentId}</Text>
                </Pressable>
              )}
            />

            {/* EDIT DOC */}
            <Sheet visible={editDocOpen} title="Uredi dokument" onClose={() => setEditDocOpen(false)}>
              <Pressable style={s.toggle} onPress={() => setDraft(v => !v)}>
                <Text style={s.toggleText}>{draft ? "Skica: DA" : "Skica: NE"}</Text>
              </Pressable>

              <TextInput value={note} onChangeText={setNote} placeholder="Zadana napomena (opcionalno)" style={s.input} />

              <Pressable
                style={[s.primary, upsertDocM.isPending && { opacity: 0.6 }]}
                disabled={upsertDocM.isPending}
                onPress={async () => {
                  if (!editDoc) return;
                  await upsertDocM.mutateAsync({
                    templateId,
                    payload: {
                      documentId: editDoc.documentId,
                      sortOrder: editDoc.sortOrder ?? 1,
                      draft,
                      defaultNote: note,
                    } as any,
                  });
                  setEditDocOpen(false);
                  tQ.refetch();
                }}
              >
                <Text style={s.primaryText}>Spremi</Text>
              </Pressable>
            </Sheet>

            {/* ITEMS */}
            <Sheet visible={itemsOpen} title="Stavke dokumenta" onClose={() => setItemsOpen(false)}>
              {!itemsDoc ? null : (
                <View style={{ gap: 10 }}>
                  <Text style={{ fontWeight: "900", color: Colors.text }}>Dokument #{itemsDoc.documentId}</Text>

                  <Pressable style={s.btnWide} onPress={() => setAddItemOpen(true)}>
                    <Text style={s.btnText}>Dodaj stavku</Text>
                  </Pressable>

                  {(itemsDoc.items ?? []).map((it, idx) => (
                    <View key={`${it.itemId}-${idx}`} style={s.itemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemTitle}>Artikl ID: {it.itemId}</Text>
                        <Text style={s.itemSub}>Količina: {it.quantity}</Text>
                      </View>
                      <Pressable style={[s.btn, { backgroundColor: Colors.dangerBg }]} onPress={() => removeItem(idx)}>
                        <Text style={[s.btnText, { color: Colors.dangerText }]}>Ukloni</Text>
                      </Pressable>
                    </View>
                  ))}

                  <Pressable
                    style={[s.primary, replaceItemsM.isPending && { opacity: 0.6 }]}
                    disabled={replaceItemsM.isPending}
                    onPress={saveItems}
                  >
                    <Text style={s.primaryText}>Spremi stavke</Text>
                  </Pressable>

                  <Text style={s.hint}>
                    Napomena: za artikle trenutno koristi ID jer nismo dobili endpoint za pretraživanje artikala.
                    Ako imaš endpoint, ubacim isti picker kao za partnere/dokumente.
                  </Text>
                </View>
              )}
            </Sheet>

            {/* ADD ITEM */}
            <Sheet visible={addItemOpen} title="Dodaj stavku" onClose={() => setAddItemOpen(false)}>
              <TextInput value={itemId} onChangeText={setItemId} placeholder="Artikl ID" keyboardType="number-pad" style={s.input} />
              <TextInput value={qty} onChangeText={setQty} placeholder="Količina" keyboardType="decimal-pad" style={s.input} />
              <Pressable style={s.primary} onPress={addItem}>
                <Text style={s.primaryText}>Dodaj</Text>
              </Pressable>
            </Sheet>
          </>
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12 },
  loading: { color: Colors.sub, fontWeight: "800", textAlign: "center", marginTop: 20 },

  primary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 14, backgroundColor: Colors.orange },
  primaryText: { color: "#fff", fontWeight: "900" },

  card: { backgroundColor: Colors.bg, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, padding: 14, gap: 8 },
  title: { fontWeight: "900", color: Colors.text, fontSize: 15 },
  sub: { color: Colors.sub, fontWeight: "800" },
  desc: { color: Colors.sub, fontWeight: "700" },
  row: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, padding: 12, borderRadius: 14, backgroundColor: "rgba(148,163,184,0.18)", alignItems: "center" },
  btnWide: { padding: 12, borderRadius: 14, backgroundColor: "rgba(148,163,184,0.18)", alignItems: "center" },
  btnText: { fontWeight: "900", color: Colors.text },

  pickRow: { padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, backgroundColor: Colors.bg, gap: 4 },
  pickTitle: { fontWeight: "900", color: Colors.text },
  pickSub: { color: Colors.sub, fontWeight: "700" },

  toggle: { padding: 12, borderRadius: 14, backgroundColor: "rgba(148,163,184,0.18)", alignItems: "center" },
  toggleText: { fontWeight: "900", color: Colors.text },
  input: { backgroundColor: Colors.bg, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontWeight: "800", color: Colors.text },

  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, backgroundColor: Colors.bg },
  itemTitle: { fontWeight: "900", color: Colors.text },
  itemSub: { color: Colors.sub, fontWeight: "700" },
  hint: { color: Colors.sub, fontWeight: "700", marginTop: 6 },
  empty: { textAlign: "center", color: Colors.sub, fontWeight: "800", marginTop: 18 },
});
