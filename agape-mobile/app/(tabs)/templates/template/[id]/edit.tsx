import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import NavigationHeader from "../../../../../components/NavigationHeader";
import { ErrorCard } from "@/components/ErrorCard";

import { toUserMessage } from "@/app/api/apiClient";
import { useTemplateDetail, useUpdateTemplate } from "@/app/api/hooks/templates/useDispatchTemplates";

const MAX_W = 560;

type Touched = {
  name: boolean;
  householdSize: boolean;
  desc: boolean;
};

export default function EditTemplateScreen() {
  const params = useLocalSearchParams<{ id?: string; templateId?: string }>();

  const templateId = useMemo(() => {
    const raw = params.id ?? params.templateId;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params.id, params.templateId]);

  const tQ = useTemplateDetail(templateId);
  const updM = useUpdateTemplate();

  const t = tQ.data;

  const [name, setName] = useState("");
  const [householdSize, setHouseholdSize] = useState("");
  const [desc, setDesc] = useState("");

  const [touched, setTouched] = useState<Touched>({
    name: false,
    householdSize: false,
    desc: false,
  });

  const [screenError, setScreenError] = useState<string | null>(null);
  const [dismissedTopError, setDismissedTopError] = useState<string | null>(null);

  useEffect(() => {
    if (!t) return;

    setName(t.name ?? "");
    setHouseholdSize(t.householdSize == null ? "" : String(t.householdSize));
    setDesc(t.description ?? "");

    setTouched({
      name: false,
      householdSize: false,
      desc: false,
    });
  }, [t?.id]);

  const markTouched = (field: keyof Touched) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const resetTransientErrors = () => {
    setScreenError(null);
    setDismissedTopError(null);
    updM.reset();
  };

  const tErrorMessage = tQ.error ? toUserMessage(tQ.error, "Greška prilikom učitavanja predloška.") : null;
  const rawTopError =
    screenError ||
    (updM.error ? toUserMessage(updM.error, "Greška pri spremanju predloška.") : null) ||
    tErrorMessage ||
    (!templateId ? "Neispravan ID predloška." : null);

  const topError = rawTopError && rawTopError !== dismissedTopError ? rawTopError : null;

  const closeTopError = () => {
    const currentRaw =
      screenError ||
      (updM.error ? toUserMessage(updM.error, "Greška pri spremanju predloška.") : null) ||
      tErrorMessage ||
      (!templateId ? "Neispravan ID predloška." : null);

    setScreenError(null);
    updM.reset();
    setDismissedTopError(currentRaw ?? null);
  };

  const nameError = useMemo(() => {
    if (!touched.name) return null;
    if (!name.trim()) return "Naziv predloška je obavezan.";
    return null;
  }, [name, touched.name]);

  const householdError = useMemo(() => {
    if (!touched.householdSize) return null;

    const raw = householdSize.trim();
    if (!raw) return "Kućanstvo je obavezno.";

    const n = Number(raw);
    if (!Number.isFinite(n)) return "Kućanstvo mora biti broj.";
    if (!Number.isInteger(n)) return "Kućanstvo mora biti cijeli broj.";
    if (n <= 0) return "Kućanstvo mora biti broj > 0.";

    return null;
  }, [householdSize, touched.householdSize]);

  const hhNum = useMemo(() => {
    const n = Number(householdSize.trim());
    return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
  }, [householdSize]);

  const canSubmit = useMemo(() => {
    return !!templateId && !!t && !!name.trim() && hhNum != null && !updM.isPending;
  }, [templateId, t, name, hhNum, updM.isPending]);

  const isLoading = (!!templateId && tQ.isLoading && !t) || false;

  return (
    <Screen>
      <NavigationHeader
        title="Uredi predložak"
        subtitle={templateId ? `#${templateId}` : "Predložak"}
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

        {isLoading ? (
          <Text style={s.loading}>Učitavam…</Text>
        ) : !t ? (
          <Text style={s.loading}>Predložak nije pronađen.</Text>
        ) : (
          <>
            <View style={s.fieldWrap}>
              <Text style={s.label}>Naziv</Text>
              <TextInput
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  resetTransientErrors();
                }}
                onBlur={() => markTouched("name")}
                placeholder="Upiši naziv…"
                placeholderTextColor={Colors.sub}
                style={[s.input, !!nameError && s.inputError]}
                returnKeyType="next"
              />
              {!!nameError && <Text style={s.fieldError}>{nameError}</Text>}
            </View>

            <View style={s.fieldWrap}>
              <Text style={s.label}>Kućanstvo</Text>
              <TextInput
                value={householdSize}
                onChangeText={(v) => {
                  setHouseholdSize(v.replace(/\D+/g, ""));
                  resetTransientErrors();
                }}
                onBlur={() => markTouched("householdSize")}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={Colors.sub}
                style={[s.input, !!householdError && s.inputError]}
                returnKeyType="next"
                maxLength={4}
              />
              {!!householdError && <Text style={s.fieldError}>{householdError}</Text>}
            </View>

            <View style={s.fieldWrap}>
              <Text style={s.label}>Opis (opcionalno)</Text>
              <TextInput
                value={desc}
                onChangeText={(v) => {
                  setDesc(v);
                  resetTransientErrors();
                }}
                onBlur={() => markTouched("desc")}
                placeholder="Upiši opis…"
                placeholderTextColor={Colors.sub}
                style={[s.input, s.textArea]}
                multiline
                textAlignVertical="top"
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                s.primary,
                (!canSubmit || updM.isPending) && s.disabled,
                pressed && canSubmit && !updM.isPending && s.pressed,
              ]}
              disabled={!canSubmit || updM.isPending}
              onPress={async () => {
                try {
                  setTouched({ name: true, householdSize: true, desc: true });
                  resetTransientErrors();

                  const nm = name.trim();
                  if (!nm || hhNum == null || !templateId) return;

                  await updM.mutateAsync({
                    id: templateId,
                    payload: {
                      name: nm,
                      householdSize: hhNum,
                      description: desc.trim(),
                    } as any,
                  });

                  router.back();
                } catch (e) {
                  setScreenError(toUserMessage(e, "Greška pri spremanju predloška."));
                }
              }}
            >
              <Text style={s.primaryText}>{updM.isPending ? "Spremam…" : "Spremi"}</Text>
            </Pressable>
          </>
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: {
    padding: 14,
    gap: 12,
  },

  loading: {
    color: Colors.sub,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 20,
  },

  card: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },

  cardTitle: {
    fontWeight: "900",
    color: Colors.text,
    fontSize: 16,
  },

  cardSub: {
    color: Colors.sub,
    fontWeight: "800",
  },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    flexWrap: "wrap",
  },

  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },

  actionBtnSoft: {
    backgroundColor: "rgba(249,115,22,0.16)",
    borderColor: "rgba(249,115,22,0.35)",
  },

  actionText: {
    fontWeight: "900",
    color: Colors.text,
  },

  fieldWrap: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    gap: 6,
  },

  label: {
    fontWeight: "900",
    color: Colors.text,
  },

  input: {
    width: "100%",
    backgroundColor: Colors.bg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "800",
    color: Colors.text,
  },

  textArea: {
    minHeight: 90,
  },

  inputError: {
    borderColor: Colors.dangerText,
    borderWidth: 1,
  },

  fieldError: {
    color: Colors.dangerText,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 2,
  },

  primary: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
    marginTop: 6,
  },

  primaryText: {
    color: "#fff",
    fontWeight: "900",
  },

  disabled: {
    opacity: 0.6,
  },

  pressed: {
    opacity: 0.85,
  },
});