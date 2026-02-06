import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const ORANGE = "#F97316";
const BORDER = "rgba(2, 6, 23, 0.12)";

export type TemplateFormValues = {
  folderId: number | null;
  householdSize: number;
  name: string;
  description: string;
};

export default function TemplateForm(props: {
  title: string;
  initial: TemplateFormValues;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: TemplateFormValues) => Promise<void> | void;
}) {
  const { title, initial, submitLabel, submitting, onSubmit } = props;

  const [folderIdText, setFolderIdText] = useState(initial.folderId == null ? "" : String(initial.folderId));
  const [householdText, setHouseholdText] = useState(String(initial.householdSize ?? 1));
  const [name, setName] = useState(initial.name ?? "");
  const [description, setDescription] = useState(initial.description ?? "");

  const parsed = useMemo(() => {
    const folderId = folderIdText.trim() ? Number(folderIdText.trim()) : null;
    const householdSize = householdText.trim() ? Number(householdText.trim()) : NaN;

    return { folderId, householdSize };
  }, [folderIdText, householdText]);

  const submit = async () => {
    const n = name.trim();
    if (!n) return Alert.alert("Greška", "Naziv je obavezan.");
    if (!Number.isFinite(parsed.householdSize) || parsed.householdSize <= 0) {
      return Alert.alert("Greška", "Kućanstvo mora biti broj > 0.");
    }

    await onSubmit({
      folderId: parsed.folderId,
      householdSize: Math.round(parsed.householdSize),
      name: n,
      description: description ?? "",
    });
  };

  return (
    <View style={s.container}>
      <Text style={s.h1}>{title}</Text>

      <View style={s.card}>
        <Text style={s.label}>Mapa (folderId, opcionalno)</Text>
        <TextInput
          value={folderIdText}
          onChangeText={setFolderIdText}
          placeholder="npr. 1 (prazno = bez mape)"
          keyboardType="number-pad"
          style={s.input}
        />

        <Text style={s.label}>Veličina kućanstva</Text>
        <TextInput
          value={householdText}
          onChangeText={setHouseholdText}
          placeholder="npr. 4"
          keyboardType="number-pad"
          style={s.input}
        />

        <Text style={s.label}>Naziv</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Naziv predloška…" style={s.input} />

        <Text style={s.label}>Opis</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Opis (opcionalno)…"
          style={[s.input, { height: 90, textAlignVertical: "top" }]}
          multiline
        />

        <Pressable style={[s.primaryBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={!!submitting}>
          <Text style={s.primaryBtnText}>{submitting ? "Spremam…" : submitLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  h1: { fontSize: 20, fontWeight: "900", color: "#0F172A" },
  card: {
    backgroundColor: "rgba(255,255,255,0.90)",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    padding: 14,
    gap: 10,
  },
  label: { fontWeight: "900", color: "#0F172A" },
  input: {
    backgroundColor: "rgba(255,255,255,0.90)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "700",
  },
  primaryBtn: { backgroundColor: ORANGE, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, alignItems: "center" },
  primaryBtnText: { color: "white", fontWeight: "900" },
});
