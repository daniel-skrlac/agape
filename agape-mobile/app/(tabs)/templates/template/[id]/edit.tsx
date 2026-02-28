import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/src/constants/Colors";
import NavigationHeader from "../../../../../components/NavigationHeader";
import { ErrorCard } from "@/components/ErrorCard";

import { toUserMessage } from "../../../../../src/api/apiClient";
import { useTemplateDetail, useUpdateTemplate } from "../../../../../src/api/hooks/templates/useDispatchTemplates";

const MAX_W = 560;

type Mode = "SVE" | "MOJI" | "DIJELJENI";

type Touched = {
  name: boolean;
  householdSize: boolean;
  desc: boolean;
};

function readNullableNumberParam(v: unknown): number | null {
  const raw = Array.isArray(v) ? v[0] : v;
  if (raw == null) return null;

  const s = String(raw).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return null;

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function readStringParam(v: unknown): string | null {
  const raw = Array.isArray(v) ? v[0] : v;
  const s = String(raw ?? "").trim();
  return s ? s : null;
}

function readModeParam(v: unknown): Mode {
  const raw = Array.isArray(v) ? v[0] : v;
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "MOJI" || s === "DIJELJENI") return s;
  return "SVE";
}

export default function EditTemplateScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    templateId?: string;
    folderId?: string;
    folderName?: string;
    mode?: string;
  }>();

  const templateId = useMemo(() => {
    const raw = params.id ?? params.templateId;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params.id, params.templateId]);

  const routeFolderId = readNullableNumberParam(params.folderId);
  const routeFolderName = readStringParam(params.folderName);
  const routeMode = readModeParam(params.mode);

  const tQ = useTemplateDetail(templateId);
  const updM = useUpdateTemplate();

  const t = tQ.data;

  const templateFolderId = useMemo(() => {
    if (routeFolderId != null) return routeFolderId;

    const fromT1 = Number((t as any)?.folderId ?? NaN);
    if (Number.isFinite(fromT1) && fromT1 > 0) return fromT1;

    const fromT2 = Number((t as any)?.folder?.id ?? NaN);
    if (Number.isFinite(fromT2) && fromT2 > 0) return fromT2;

    return null;
  }, [routeFolderId, t]);

  const templateFolderName = useMemo(() => {
    const a = routeFolderName?.trim();
    if (a) return a;

    const b = String((t as any)?.folderName ?? "").trim();
    if (b) return b;

    const c = String((t as any)?.folder?.name ?? "").trim();
    if (c) return c;

    return "Mapa";
  }, [routeFolderName, t]);

  const backHref = useMemo(() => {
    if (templateFolderId) {
      return {
        pathname: "/(tabs)/templates/folder/[folderId]" as const,
        params: {
          folderId: String(templateFolderId),
          folderName: templateFolderName,
          mode: routeMode,
        },
      };
    }

    if (templateId) {
      return {
        pathname: "/(tabs)/templates/template/[id]" as const,
        params: {
          id: String(templateId),
          folderId: templateFolderId ? String(templateFolderId) : "null",
          folderName: templateFolderName,
          mode: routeMode,
        },
      };
    }

    return "/(tabs)/templates" as const;
  }, [templateFolderId, templateFolderName, routeMode, templateId]);

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
        fallbackHref={backHref}
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

                  router.replace(backHref as any);
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