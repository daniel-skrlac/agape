import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";

import { ErrorCard } from "@/components/ErrorCard";
import NavigationHeader from "@/components/NavigationHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import Screen from "@/components/ui/Screen";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";
import Colors from "@/src/constants/Colors";
import type {
  DispatchSlipParsedDTO,
  DispatchSlipScanCorrectionRequestDTO,
  ItemDescriptorResponseDTO,
  PartnerResponseDTO,
} from "@/src/models/generated";
import { toUserMessage } from "@/src/api/apiClient";
import { useBookingSession } from "@/src/api/hooks/sessions/useBookingSessions";
import {
  useCorrectDispatchSlip,
  useSaveDispatchSlipSessionEntry,
  useUploadDispatchSlip,
} from "@/src/api/hooks/scans/useDispatchSlipScans";
import { partnerService } from "@/src/api/services/partnerService";
import { itemDirectoryService } from "@/src/api/services/itemDirectoryService";
import { s } from "@/src/styles/DispatchSlipScan.styles";

type SelectedFile = {
  uri: string;
  name: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
};

type EditableScanLine = {
  slipItemCode?: string | null;
  documentId?: number | null;
  itemId?: number | null;
  itemName?: string | null;
  itemCode?: string | null;
  unit?: string | null;
  quantity: string;
  confidence?: number | null;
  warning?: string | null;
  lowConfidence?: boolean | null;
};

type AssuranceLevel = "high" | "medium" | "low";

type AssuranceSummary = {
  average: number | null;
  high: number;
  medium: number;
  low: number;
  missingItems: number;
  positiveLines: number;
  total: number;
  level: AssuranceLevel;
};

function firstParam(v: unknown) {
  return Array.isArray(v) ? v[0] : v;
}

function cleanNumber(v: unknown): number | null {
  const n = Number(String(firstParam(v) ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cleanParamText(v: unknown) {
  const s = String(firstParam(v) ?? "").trim();
  return s || null;
}

function toDateInput(v: unknown) {
  if (!v) return new Date().toISOString().slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function linesFromParsed(parsed: DispatchSlipParsedDTO): EditableScanLine[] {
  return ((parsed as any)?.lines ?? []).map((line: any) => ({
    slipItemCode: line?.slipItemCode ?? null,
    documentId: cleanNumber(line?.documentId),
    itemId: cleanNumber(line?.itemId),
    itemName: line?.itemName ?? null,
    itemCode: line?.itemCode ?? null,
    unit: line?.unit ?? null,
    quantity: String(line?.quantity ?? ""),
    confidence: line?.confidence == null ? null : Number(line.confidence),
    warning: line?.warning ?? null,
    lowConfidence: !!line?.lowConfidence,
  }));
}

function partnerLabel(partner: PartnerResponseDTO | null, partnerId: number | null, nameHint?: string | null) {
  const name = String((partner as any)?.name ?? nameHint ?? "").trim();
  const number = String((partner as any)?.partnerNumber ?? "").trim();
  const city = String((partner as any)?.city ?? "").trim();
  if (name) return [name, number ? `#${number}` : null, city || null].filter(Boolean).join(" • ");
  return partnerId ? "Učitavam partnera..." : "Odaberi partnera";
}

function itemTitle(item: ItemDescriptorResponseDTO | null | undefined) {
  return String((item as any)?.name ?? (item as any)?.itemName ?? "").trim() || "Artikl";
}

function itemCode(item: ItemDescriptorResponseDTO | null | undefined) {
  return String((item as any)?.code ?? (item as any)?.itemCode ?? "").trim();
}

function itemMeta(item: ItemDescriptorResponseDTO | null | undefined) {
  return [
    itemCode(item) ? `Šifra: ${itemCode(item)}` : null,
    (item as any)?.unit ? `JMJ: ${(item as any)?.unit}` : null,
    (item as any)?.barcode ? `BC: ${(item as any)?.barcode}` : null,
  ].filter(Boolean).join(" • ");
}

function normalizeConfidence(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n > 1) return Math.max(0, Math.min(1, n / 100));
  return Math.max(0, Math.min(1, n));
}

function confidencePercent(v: unknown) {
  const n = normalizeConfidence(v);
  return n == null ? null : Math.round(n * 100);
}

function confidenceLevel(v: unknown): AssuranceLevel {
  const n = normalizeConfidence(v);
  if (n == null) return "medium";
  if (n >= 0.85) return "high";
  if (n >= 0.65) return "medium";
  return "low";
}

function lineQuantityValue(line: Pick<EditableScanLine, "quantity">) {
  const n = Number(String(line.quantity ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function assuranceText(level: AssuranceLevel) {
  if (level === "high") return "Visoka sigurnost";
  if (level === "medium") return "Provjeriti";
  return "Niska sigurnost";
}

function assuranceStyle(level: AssuranceLevel) {
  if (level === "high") return s.assuranceHigh;
  if (level === "medium") return s.assuranceMedium;
  return s.assuranceLow;
}

function usefulParserWarnings(parsed: DispatchSlipParsedDTO | null) {
  const hidden = [
    "mock parser",
    "partner could not be resolved",
    "template could not be resolved",
    "please select partner",
    "please select template",
  ];

  return (((parsed as any)?.warnings ?? []) as string[])
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .filter((warning) => {
      const low = warning.toLowerCase();
      return !hidden.some((needle) => low.includes(needle));
    });
}

function summarizeAssurance(parsed: DispatchSlipParsedDTO | null, lines: EditableScanLine[]): AssuranceSummary {
  const confidences = lines
    .map((line) => normalizeConfidence(line.confidence))
    .filter((x): x is number => x != null);

  const average =
    normalizeConfidence((parsed as any)?.averageConfidence) ??
    (confidences.length ? confidences.reduce((sum, x) => sum + x, 0) / confidences.length : null);

  const high = lines.filter((line) => confidenceLevel(line.confidence) === "high").length;
  const medium = lines.filter((line) => confidenceLevel(line.confidence) === "medium").length;
  const low = lines.filter((line) => confidenceLevel(line.confidence) === "low").length;
  const positiveLines = lines.filter((line) => lineQuantityValue(line) > 0).length;
  const missingItems = lines.filter((line) => lineQuantityValue(line) > 0 && !cleanNumber(line.itemId)).length;

  const baseLevel = average == null ? "medium" : average >= 0.85 ? "high" : average >= 0.65 ? "medium" : "low";
  const level = missingItems > 0 || low > 0 ? "low" : baseLevel;

  return { average, high, medium, low, missingItems, positiveLines, total: lines.length, level };
}

function linkedLineSubtitle(line: EditableScanLine) {
  const parts = [
    line.itemCode ? `Šifra: ${line.itemCode}` : line.slipItemCode ? `Slip: ${line.slipItemCode}` : null,
    line.unit ? `JMJ: ${line.unit}` : null,
  ].filter(Boolean);
  return parts.join(" • ");
}

function lineDisplayName(line: EditableScanLine) {
  const name = String(line.itemName ?? "").trim();
  if (name && !/^Artikl\s+\d+$/i.test(name)) return name;
  if (name) return name;
  return line.itemCode || line.slipItemCode || "Stavka";
}

export default function DispatchSlipScanScreen() {
  const params = useLocalSearchParams<{
    id: string;
    partnerId?: string;
    partnerName?: string;
    templateId?: string;
  }>();
  const sessionId = Number(params.id);
  const initialPartnerId = cleanNumber(params.partnerId);
  const initialTemplateId = cleanNumber(params.templateId);
  const routePartnerNameHint = cleanParamText(params.partnerName);

  const sessionQ = useBookingSession(sessionId);
  const uploadM = useUploadDispatchSlip();

  const [scanId, setScanId] = useState<number | null>(null);
  const correctM = useCorrectDispatchSlip(scanId || 0);
  const saveEntryM = useSaveDispatchSlipSessionEntry(scanId || 0, sessionId);

  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [parsed, setParsed] = useState<DispatchSlipParsedDTO | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<PartnerResponseDTO | null>(null);
  const [partnerNameHint, setPartnerNameHint] = useState<string | null>(routePartnerNameHint);
  const [partnerId, setPartnerId] = useState<number | null>(initialPartnerId);
  const [templateId, setTemplateId] = useState<number | null>(initialTemplateId);
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("Skenirano iz papirnate otpremnice.");
  const [lines, setLines] = useState<EditableScanLine[]>([]);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [itemPickerIndex, setItemPickerIndex] = useState<number | null>(null);
  const [filePicking, setFilePicking] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const analysisPulse = useMemo(() => new Animated.Value(0), []);
  const analysisTranslate = useMemo(
    () => analysisPulse.interpolate({ inputRange: [0, 1], outputRange: [-90, 360] }),
    [analysisPulse]
  );

  const warehouseId = cleanNumber((sessionQ.data as any)?.warehouseId);
  const selectedPartnerId = useMemo(() => cleanNumber((selectedPartner as any)?.id), [selectedPartner]);
  const displayPartner = selectedPartnerId === partnerId ? selectedPartner : null;
  const busy = uploadM.isPending || correctM.isPending || saveEntryM.isPending || filePicking;
  const uploadContextHint = !partnerId
    ? "Vrati se na unos i odaberi partnera prije skeniranja."
    : null;
  const introText = "Slikaj ili učitaj slip. Šifre s papira automatski se povezuju s artiklima iz skladišta.";
  const parserWarnings = useMemo(() => usefulParserWarnings(parsed), [parsed]);
  const assurance = useMemo(() => summarizeAssurance(parsed, lines), [parsed, lines]);

  useEffect(() => {
    if (routePartnerNameHint) setPartnerNameHint(routePartnerNameHint);
  }, [routePartnerNameHint]);

  useEffect(() => {
    if (!uploadM.isPending) {
      analysisPulse.stopAnimation();
      analysisPulse.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(analysisPulse, {
        toValue: 1,
        duration: 1250,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [analysisPulse, uploadM.isPending]);

  useEffect(() => {
    if (!partnerId) {
      setSelectedPartner(null);
      return;
    }
    if (selectedPartnerId === partnerId) return;

    let alive = true;
    const controller = new AbortController();

    partnerService
      .getPartner(partnerId, controller.signal)
      .then((partner) => {
        if (!alive) return;
        setSelectedPartner(partner);
        const name = cleanParamText((partner as any)?.name);
        if (name) setPartnerNameHint(name);
      })
      .catch(() => {
        // The selected id remains valid for submit; the label falls back to the route hint/loading text.
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [partnerId, selectedPartnerId]);

  const validationError = useMemo(() => {
    if (!selectedFile) return "Odaberi ili slikaj otpremnicu.";
    if (!parsed || !scanId) return "Validiraj otpremnicu prije spremanja.";
    if (!partnerId) return "Odaberi partnera prije spremanja.";
    const usable = lines
      .map((line) => ({
        documentId: cleanNumber(line.documentId),
        itemId: cleanNumber(line.itemId),
        quantity: Number(String(line.quantity).replace(",", ".")),
      }))
      .filter((line) => line.quantity > 0);
    if (!usable.length) return "Unesi barem jednu pozitivnu količinu.";
    if (usable.some((line) => !line.itemId)) {
      return "Poveži sve skenirane stavke s artiklima prije spremanja.";
    }
    return null;
  }, [selectedFile, parsed, scanId, partnerId, lines]);

  const applyParsed = useCallback(
    (next: DispatchSlipParsedDTO) => {
      setParsed(next);
      setScanId(Number((next as any)?.scanId ?? 0) || null);
      const parsedPartnerName = cleanParamText((next as any)?.partnerName);
      if (parsedPartnerName) setPartnerNameHint(parsedPartnerName);
      setPartnerId((prev) => cleanNumber((next as any)?.partnerId) ?? prev ?? initialPartnerId);
      setTemplateId((prev) => cleanNumber((next as any)?.templateId) ?? prev ?? initialTemplateId);
      setDocumentDate(toDateInput((next as any)?.documentDate));
      setLines(linesFromParsed(next));
    },
    [initialPartnerId, initialTemplateId]
  );

  const goBackToPreviousContext = useCallback(() => {
    if (partnerId) {
      router.replace({
        pathname: "/(tabs)/sessions/[id]/entry" as const,
        params: {
          id: String(sessionId),
          partnerId: String(partnerId),
          partnerName: partnerNameHint || undefined,
        },
      });
      return;
    }
    router.replace({ pathname: "/(tabs)/sessions/[id]" as const, params: { id: String(sessionId) } });
  }, [sessionId, partnerId, partnerNameHint]);

  const setNextFile = useCallback((file: SelectedFile) => {
    setSelectedFile(file);
    setParsed(null);
    setScanId(null);
    setLines([]);
    setScreenError(null);
    setImageLoading(file.mimeType.startsWith("image/"));
  }, []);

  const pickCamera = useCallback(async () => {
    setScreenError(null);
    setFilePicking(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setScreenError("Kamera nije dopuštena.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setNextFile({
        uri: asset.uri,
        name: asset.fileName || "dispatch-slip.jpg",
        mimeType: asset.mimeType || "image/jpeg",
        width: asset.width,
        height: asset.height,
      });
    } finally {
      setFilePicking(false);
    }
  }, [setNextFile]);

  const pickDocument = useCallback(async () => {
    setScreenError(null);
    setFilePicking(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setNextFile({
        uri: asset.uri,
        name: asset.name || "dispatch-slip",
        mimeType: asset.mimeType || "application/octet-stream",
        width: null,
        height: null,
      });
    } finally {
      setFilePicking(false);
    }
  }, [setNextFile]);

  const upload = useCallback(async () => {
    if (!selectedFile) return;
    if (!partnerId) {
      setScreenError("Prije obrade odaberi partnera.");
      return;
    }
    try {
      setScreenError(null);
      const result = await uploadM.mutateAsync({
        ...selectedFile,
        bookingSessionId: sessionId,
        partnerId,
        templateId,
        warehouseId,
      });
      applyParsed((result as any).parsed);
    } catch (e) {
      setScreenError(toUserMessage(e, "Greška pri obradi otpremnice."));
    }
  }, [selectedFile, uploadM, sessionId, partnerId, templateId, warehouseId, applyParsed]);

  const updateLine = useCallback((index: number, patch: Partial<EditableScanLine>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }, []);

  const pickItemForLine = useCallback((item: ItemDescriptorResponseDTO, close: () => void) => {
    if (itemPickerIndex == null) return;
    const selectedItemId = cleanNumber((item as any)?.itemId ?? (item as any)?.id);
    if (!selectedItemId) return;

    const code = itemCode(item);
    updateLine(itemPickerIndex, {
      itemId: selectedItemId,
      itemName: itemTitle(item),
      itemCode: code || null,
      unit: String((item as any)?.unit ?? "").trim() || null,
      documentId: templateId ? lines[itemPickerIndex]?.documentId ?? null : null,
      warning: null,
    });
    setItemPickerIndex(null);
    close();
  }, [itemPickerIndex, lines, templateId, updateLine]);

  const save = useCallback(async () => {
    if (!scanId || validationError || !partnerId) return;

    try {
      setScreenError(null);
      const correctionPayload: DispatchSlipScanCorrectionRequestDTO = {
        partnerId,
        templateId: (templateId || null) as any,
        warehouseId,
        documentDate: documentDate as any,
        note,
        lines: lines
          .map((line) => ({
            slipItemCode: line.slipItemCode ?? undefined,
            documentId: (templateId ? cleanNumber(line.documentId) : null) as any,
            itemId: cleanNumber(line.itemId) as any,
            quantity: Number(String(line.quantity).replace(",", ".")),
          }))
          .filter((line) => line.itemId && line.quantity > 0) as any,
      } as any;

      await correctM.mutateAsync(correctionPayload);
      await saveEntryM.mutateAsync({
        bookingSessionId: sessionId,
        partnerId,
        templateId: (templateId || null) as any,
        draftMode: "FINAL" as any,
        documentDate: documentDate as any,
        note,
      });

      router.replace({ pathname: "/(tabs)/sessions/[id]" as const, params: { id: String(sessionId) } });
    } catch (e) {
      setScreenError(toUserMessage(e, "Greška pri spremanju skenirane otpremnice."));
    }
  }, [
    scanId,
    validationError,
    partnerId,
    templateId,
    warehouseId,
    documentDate,
    note,
    lines,
    correctM,
    saveEntryM,
    sessionId,
  ]);

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <NavigationHeader title="Skeniraj otpremnicu" onBackPress={goBackToPreviousContext} />

      <SearchPickerSheet<ItemDescriptorResponseDTO>
        visible={itemPickerIndex != null}
        title="Poveži artikl"
        onClose={() => setItemPickerIndex(null)}
        keyOf={(item) => String((item as any)?.itemId ?? (item as any)?.id)}
        queryKeyBase={["scan-items", warehouseId ?? "no-warehouse"]}
        queryPage={({ page, size, q }) => {
          if (!warehouseId) return Promise.resolve({ items: [], page, size, total: 0 });
          return itemDirectoryService.pageItems({ warehouseId, page, size, q });
        }}
        searchPlaceholder="Pretraži artikle..."
        renderRow={(item, close) => (
          <Pressable style={s.pickerRow} onPress={() => pickItemForLine(item, close)}>
            <View style={{ flex: 1 }}>
              <Text style={s.pickerTitle}>{itemTitle(item)}</Text>
              {!!itemMeta(item) && <Text style={s.pickerSub}>{itemMeta(item)}</Text>}
            </View>
          </Pressable>
        )}
      />

      <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={() => setPreviewOpen(false)}>
        <View style={s.modalWrap}>
          <Pressable style={s.modalClose} onPress={() => setPreviewOpen(false)}>
            <Text style={s.modalCloseText}>Zatvori</Text>
          </Pressable>
          {!!selectedFile?.uri && (
            <Image source={{ uri: selectedFile.uri }} style={s.modalImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {!!(screenError || sessionQ.error) && (
          <ErrorCard
            message={
              screenError ||
              toUserMessage(sessionQ.error, "Greška pri učitavanju podataka.")
            }
            onAction={() => {
              setScreenError(null);
              sessionQ.refetch();
            }}
          />
        )}

        {!!uploadContextHint && (
          <ErrorCard
            title="Nedostaje kontekst"
            message={uploadContextHint}
            actionText="Nazad na unos"
            onAction={goBackToPreviousContext}
            messageLines={2}
          />
        )}

        <View style={s.card}>
          <Text style={s.title}>Papirnata otpremnica</Text>
          <Text style={s.sub}>{introText}</Text>

          <View style={s.partnerContext}>
            <Text style={s.partnerContextLabel}>Partner</Text>
            <Text style={s.partnerContextName} numberOfLines={2}>
              {partnerLabel(displayPartner, partnerId, partnerNameHint)}
            </Text>
          </View>

          {selectedFile?.mimeType?.startsWith("image/") ? (
            <>
              <Pressable style={s.previewWrap} onPress={() => setPreviewOpen(true)}>
                <Image
                  source={{ uri: selectedFile.uri }}
                  style={s.previewImage}
                  resizeMode="contain"
                  onLoadStart={() => setImageLoading(true)}
                  onLoadEnd={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
                />
                {imageLoading && (
                  <View style={s.previewLoading} pointerEvents="none">
                    <ActivityIndicator />
                    <Text style={s.previewLoadingText}>Učitavam sliku...</Text>
                  </View>
                )}
              </Pressable>
              <Text style={s.fileName} numberOfLines={1}>
                {selectedFile.name} • dodirni sliku za veći prikaz
              </Text>
            </>
          ) : selectedFile ? (
            <View style={s.pill}>
              <Text style={s.pillText}>{selectedFile.name}</Text>
            </View>
          ) : null}

          <View style={s.actions}>
            <Pressable style={s.secondary} onPress={pickCamera} disabled={busy || !!uploadContextHint}>
              {filePicking ? <ActivityIndicator /> : <Text style={s.secondaryText}>Slikaj</Text>}
            </Pressable>
            <Pressable style={s.secondary} onPress={pickDocument} disabled={busy || !!uploadContextHint}>
              {filePicking ? <ActivityIndicator /> : <Text style={s.secondaryText}>Učitaj datoteku</Text>}
            </Pressable>
          </View>

          {!!selectedFile && !!uploadContextHint && <Text style={s.warning}>{uploadContextHint}</Text>}

          <PrimaryButton
            label={uploadM.isPending ? "Validiram..." : parsed ? "Ponovno validiraj" : "Validiraj"}
            onPress={upload}
            loading={uploadM.isPending}
            disabled={!selectedFile || !!uploadContextHint || busy || imageLoading}
          />
        </View>

        {uploadM.isPending && (
          <View style={[s.card, s.analysisCard]}>
            <View style={s.analysisTop}>
              <ActivityIndicator color="#2563EB" />
              <Text style={s.analysisTitle}>Analiziram dokument</Text>
            </View>
            <View style={s.analysisTrack}>
              <Animated.View style={[s.analysisSweep, { transform: [{ translateX: analysisTranslate }] }]} />
            </View>
            <Text style={s.analysisText}>Tražim šifre artikala, količine i povezujem ih sa skladištem.</Text>
          </View>
        )}

        {!!parsed && (
          <>
            <View style={s.card}>
              <View style={s.assuranceHeader}>
                <View>
                  <Text style={s.title}>Provjera</Text>
                  <Text style={s.sub}>Sažetak sigurnosti očitanih stavki</Text>
                </View>
                <View style={[s.assurancePill, assuranceStyle(assurance.level)]}>
                  <Text style={s.assurancePillText}>{assuranceText(assurance.level)}</Text>
                </View>
              </View>

              <View style={s.scoreRow}>
                <View style={s.scoreCircle}>
                  <Text style={s.scoreNumber}>
                    {assurance.average == null ? "--" : `${Math.round(assurance.average * 100)}%`}
                  </Text>
                  <Text style={s.scoreLabel}>prosjek</Text>
                </View>
                <View style={s.scoreDetails}>
                  <View style={s.metricRow}>
                    <Text style={s.metricLabel}>Visoka sigurnost</Text>
                    <Text style={[s.metricValue, s.metricHigh]}>{assurance.high}</Text>
                  </View>
                  <View style={s.metricRow}>
                    <Text style={s.metricLabel}>Za provjeru</Text>
                    <Text style={[s.metricValue, s.metricMedium]}>{assurance.medium}</Text>
                  </View>
                  <View style={s.metricRow}>
                    <Text style={s.metricLabel}>Niska sigurnost</Text>
                    <Text style={[s.metricValue, s.metricLow]}>{assurance.low}</Text>
                  </View>
                  <View style={s.metricRow}>
                    <Text style={s.metricLabel}>Nepovezani artikli</Text>
                    <Text style={[s.metricValue, assurance.missingItems ? s.metricLow : s.metricHigh]}>
                      {assurance.missingItems}
                    </Text>
                  </View>
                  <View style={s.metricRow}>
                    <Text style={s.metricLabel}>Ćelija na slipu</Text>
                    <Text style={s.metricValue}>{assurance.total}</Text>
                  </View>
                  <View style={s.metricRow}>
                    <Text style={s.metricLabel}>Količina za spremanje</Text>
                    <Text style={s.metricValue}>{assurance.positiveLines}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.title}>Podaci</Text>
              {parserWarnings.map((warning, i) => (
                <Text key={`${warning}-${i}`} style={s.warning}>
                  {warning}
                </Text>
              ))}

              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Partner</Text>
                <Text style={s.infoValue}>{partnerLabel(displayPartner, partnerId, partnerNameHint)}</Text>
              </View>
              <TextInput
                style={s.field}
                value={documentDate}
                onChangeText={setDocumentDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.sub}
              />
              <TextInput
                style={[s.field, { minHeight: 76, paddingTop: 12 }]}
                value={note}
                onChangeText={setNote}
                multiline
                placeholder="Napomena"
                placeholderTextColor={Colors.sub}
              />
            </View>

            <View style={s.card}>
              <Text style={s.title}>Stavke</Text>
              {lines.map((line, index) => {
                const level = confidenceLevel(line.confidence);
                const pct = confidencePercent(line.confidence);
                const hasPositiveQuantity = lineQuantityValue(line) > 0;
                return (
                  <View key={`${line.slipItemCode ?? "line"}-${index}`} style={[s.row, level === "low" && s.rowLow]}>
                    <View style={s.rowTop}>
                      <Text style={s.rowTitle}>
                        {line.slipItemCode || "----"} • {lineDisplayName(line)}
                      </Text>
                      <View style={[s.assurancePill, assuranceStyle(level)]}>
                        <Text style={s.assurancePillText}>{pct == null ? "n/a" : `${pct}%`}</Text>
                      </View>
                    </View>
                    {!!line.warning && <Text style={s.warning}>{line.warning}</Text>}
                    <View style={s.confidenceLine}>
                      <Text style={s.sub}>{assuranceText(level)}</Text>
                      {!!linkedLineSubtitle(line) && <Text style={s.sub}>{linkedLineSubtitle(line)}</Text>}
                    </View>
                    <TextInput
                      style={s.qtyInput}
                      value={line.quantity}
                      onChangeText={(v) => updateLine(index, { quantity: v })}
                      keyboardType="decimal-pad"
                      placeholder="Količina"
                      placeholderTextColor={Colors.sub}
                    />
                    <Pressable
                      style={s.linkButton}
                      onPress={() => setItemPickerIndex(index)}
                      disabled={busy || !warehouseId}
                    >
                      <Text style={s.linkButtonText}>
                        {line.itemId ? "Promijeni artikl" : "Poveži artikl"}
                      </Text>
                    </Pressable>
                    {!line.itemId && hasPositiveQuantity ? (
                      <Text style={s.warning}>Stavka nije povezana s artiklom. Odaberi artikl iz šifrarnika.</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View style={s.card}>
              {!!validationError && <Text style={s.warning}>{validationError}</Text>}
              <PrimaryButton
                label={saveEntryM.isPending || correctM.isPending ? "Spremam…" : "Pošalji i spremi"}
                onPress={save}
                loading={saveEntryM.isPending || correctM.isPending}
                disabled={!!validationError || busy}
              />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
