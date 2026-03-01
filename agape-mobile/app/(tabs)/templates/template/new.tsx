import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, Pressable, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/src/constants/Colors";
import NavigationHeader from "../../../../components/NavigationHeader";
import { ErrorCard } from "@/components/ErrorCard";

import { toUserMessage } from "../../../../src/api/apiClient";
import { useCreateTemplate } from "../../../../src/api/hooks/templates/useDispatchTemplates";

type Touched = {
  name: boolean;
  householdSize: boolean;
  desc: boolean;
};

export default function NewTemplateScreen() {
  const params = useLocalSearchParams<{ folderId?: string; folderName?: string }>();

  const folderIdRaw = params.folderId;
  const folderId = useMemo(() => {
    if (!folderIdRaw || folderIdRaw === "null" || folderIdRaw === "undefined") return null;
    const n = Number(folderIdRaw);
    return Number.isFinite(n) ? n : null;
  }, [folderIdRaw]);

  const folderName = (params.folderName as string) ?? (folderId == null ? "Bez mape" : "Mapa");
  const targetLabel = folderId == null ? "Bez mape (root)" : folderName;

  const createTemplateM = useCreateTemplate();

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [householdSize, setHouseholdSize] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [touched, setTouched] = useState<Touched>({
    name: false,
    householdSize: false,
    desc: false,
  });

  const markTouched = (field: keyof Touched) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const clearFormError = () => setFormError(null);

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

  const canSubmit = useMemo(() => {
    const nm = name.trim();
    const hs = Number(householdSize.trim());

    return !!nm && Number.isFinite(hs) && Number.isInteger(hs) && hs > 0 && !createTemplateM.isPending;
  }, [name, householdSize, createTemplateM.isPending]);

  const onChangeName = (v: string) => {
    setName(v);
    clearFormError();
  };

  const onChangeDesc = (v: string) => {
    setDesc(v);
    clearFormError();
  };

  const onChangeHousehold = (v: string) => {
    const digits = v.replace(/\D+/g, "");
    setHouseholdSize(digits);
    clearFormError();
  };

  const handleSave = async () => {
    if (createTemplateM.isPending) return;

    setTouched({ name: true, householdSize: true, desc: true });
    setFormError(null);

    const nm = name.trim();
    const hs = Number(householdSize.trim());

    const valid = !!nm && Number.isFinite(hs) && Number.isInteger(hs) && hs > 0;
    if (!valid) return;

    try {
      const created = await createTemplateM.mutateAsync({
        folderId: (folderId as any) ?? null,
        householdSize: hs,
        name: nm,
        description: desc.trim(),
      } as any);

      router.replace({
        pathname: "/(tabs)/templates/template/[id]",
        params: { id: String((created as any)?.id) },
      });
    } catch (e) {
      setFormError(toUserMessage(e, "Greška pri kreiranju predloška."));
    }
  };

  return (
    <Screen>
      <NavigationHeader
        title="Novi predložak"
        subtitle={folderName ? `Mapa: ${folderName}` : "Root"}
        fallbackHref="/(tabs)/templates"
      />

      <View style={s.container}>
        {!!formError && (
          <ErrorCard
            title="Greška"
            message={formError}
            actionText="Zatvori"
            onAction={clearFormError}
            titleLines={1}
            messageLines={3}
          />
        )}

        <View style={s.infoBox}>
          <FontAwesome name="folder" size={16} color={Colors.text} />
          <Text style={s.infoText}>
            Dodaje se u: <Text style={s.infoStrong}>{targetLabel}</Text>
          </Text>
        </View>

        <View style={s.fieldWrap}>
          <TextInput
            value={name}
            onChangeText={onChangeName}
            onBlur={() => markTouched("name")}
            placeholder="Naziv predloška"
            placeholderTextColor={Colors.sub}
            style={[s.input, !!nameError && s.inputError]}
            returnKeyType="next"
          />
          {!!nameError && <Text style={s.fieldError}>{nameError}</Text>}
        </View>

        <View style={s.fieldWrap}>
          <TextInput
            value={householdSize}
            onChangeText={onChangeHousehold}
            onBlur={() => markTouched("householdSize")}
            placeholder="Kućanstvo (npr. 1)"
            keyboardType="number-pad"
            placeholderTextColor={Colors.sub}
            style={[s.input, !!householdError && s.inputError]}
            returnKeyType="next"
            maxLength={4}
          />
          {!!householdError && <Text style={s.fieldError}>{householdError}</Text>}
        </View>

        <View style={s.fieldWrap}>
          <TextInput
            value={desc}
            onChangeText={onChangeDesc}
            onBlur={() => markTouched("desc")}
            placeholder="Opis (opcionalno)"
            placeholderTextColor={Colors.sub}
            style={[s.input, s.textArea]}
            multiline
            textAlignVertical="top"
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            s.primary,
            (!canSubmit || createTemplateM.isPending) && s.disabled,
            pressed && canSubmit && !createTemplateM.isPending && s.pressed,
          ]}
          disabled={!canSubmit || createTemplateM.isPending}
          onPress={handleSave}
        >
          <Text style={s.primaryText}>{createTemplateM.isPending ? "Spremam…" : "Spremi predložak"}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: {
    padding: 14,
    gap: 12,
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: "rgba(148,163,184,0.10)",
  },

  infoText: {
    color: Colors.text,
    fontWeight: "800",
    flex: 1,
  },

  infoStrong: {
    color: Colors.text,
    fontWeight: "900",
  },

  fieldWrap: {
    gap: 6,
  },

  input: {
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
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
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