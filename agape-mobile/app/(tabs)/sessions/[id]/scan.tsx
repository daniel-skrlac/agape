import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Easing,
    Image,
    Keyboard,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
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
    BookingSessionScanLineValidationDTO,
    BookingSessionScanValidateResponseDTO,
    DispatchSlipParsedDTO,
    ItemDescriptorResponseDTO,
    PartnerResponseDTO,
} from "@/src/models/generated";
import { toUserMessage } from "@/src/api/apiClient";
import { useBookingSession } from "@/src/api/hooks/sessions/useBookingSessions";
import {
    useParseDispatchSlip,
    useSaveDispatchSlipScanEntry,
    useValidateDispatchSlipScan,
} from "@/src/api/hooks/scans/useDispatchSlipScans";
import { partnerService } from "@/src/api/services/partnerService";
import { itemDirectoryService } from "@/src/api/services/itemDirectoryService";
import { s } from "@/src/styles/DispatchSlipScan.styles";
import { dateToIsoLocal, fmtHrFromIso, isoToDateLocal, todayLocalNoon } from "@/src/utils/dateIso";

declare const require: any;

const CameraPackage = (() => {
    try {
        return require("expo-camera");
    } catch {
        return null;
    }
})();

const CameraView = CameraPackage?.CameraView ?? null;

type SelectedFile = {
    uri: string;
    name: string;
    mimeType: string;
    width?: number | null;
    height?: number | null;
};

type EditableScanLine = {
    slipItemCode?: string | null;
    source?: string | null;
    documentId?: number | null;
    itemId?: number | null;
    itemCode?: string | null;
    itemName?: string | null;
    unit?: string | null;
    quantity: string;
    itemResolved?: boolean | null;
    quantityValid?: boolean | null;
    requiresManualItem?: boolean | null;
    requiresManualQuantity?: boolean | null;
    valid?: boolean | null;
    warning?: string | null;
    confidence?: number | null;
    confidenceLevel?: string | null;
};

type ScanPage = {
    id: string;
    file: SelectedFile;
    parsed: DispatchSlipParsedDTO | null;
    partnerId: number | null;
    selectedPartner: PartnerResponseDTO | null;
    partnerNameHint: string | null;
    templateId: number | null;
    documentDate: string;
    note: string;
    rawText: string;
    partnerConfidence: number | null;
    documentDateConfidence: number | null;
    lines: EditableScanLine[];
    validatedKey: string | null;
    lastValidation: BookingSessionScanValidateResponseDTO | null;
    imageLoading: boolean;
};

type AssuranceLevel = "high" | "medium" | "low";
type PickingAction = "addCamera" | "addFile" | "replaceCamera" | "replaceFile" | null;
type ScannerMode = "add" | "replace";
type ScannerSession = {
    mode: ScannerMode;
    capturedFile: SelectedFile | null;
    ready: boolean;
    error: string | null;
};

function firstParam(v: unknown) {
    return Array.isArray(v) ? v[0] : v;
}

function cleanNumber(v: unknown): number | null {
    const n = Number(String(firstParam(v) ?? "").trim());
    return Number.isFinite(n) && n > 0 ? n : null;
}

function cleanParamText(v: unknown) {
    const text = String(firstParam(v) ?? "").trim();
    return text || null;
}

function toDateInput(v: unknown) {
    if (!v) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const text = String(v).trim();
    return text ? text.slice(0, 10) : "";
}

function nullableDateInput(v: string | null | undefined) {
    const text = String(v ?? "").trim();
    return text ? text : null;
}

function quantityValue(line: Pick<EditableScanLine, "quantity">) {
    const n = Number(String(line.quantity ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
}

function toQuantityInput(v: unknown) {
    if (v == null) return "";
    const n = Number(String(v).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return "";
    return String(v);
}

function confidenceValue(v: unknown): number | null {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    if (n > 1) return Math.max(0, Math.min(1, n / 100));
    return Math.max(0, Math.min(1, n));
}

function normalizeConfidenceLevel(v: unknown): string | null {
    const text = String(v ?? "").trim().toUpperCase();
    if (text === "HIGH" || text === "MEDIUM" || text === "LOW" || text === "UNKNOWN") {
        return text;
    }
    return null;
}

function confidencePercent(v: unknown) {
    const n = confidenceValue(v);
    return n == null ? null : Math.round(n * 100);
}

function metricNumber(v: unknown, digits = 0) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "nije dostupno";
    return n.toFixed(digits);
}

function metricPercent(v: unknown) {
    const pct = confidencePercent(v);
    return pct == null ? "nije dostupno" : `${pct}%`;
}

function lowConfidence(v: unknown, threshold = 0.55) {
    const n = confidenceValue(v);
    return n != null && n < threshold;
}

function confidenceLevelFromValues(confidence: unknown, backendLevel?: unknown): AssuranceLevel {
    const normalized = normalizeConfidenceLevel(backendLevel);

    if (normalized === "HIGH") return "high";
    if (normalized === "MEDIUM") return "medium";
    if (normalized === "LOW") return "low";

    const n = confidenceValue(confidence);
    if (n == null) return "medium";
    if (n >= 0.80) return "high";
    if (n >= 0.60) return "medium";
    return "low";
}

function confidenceText(confidence: unknown, backendLevel?: unknown) {
    const pct = confidencePercent(confidence);
    const normalized = normalizeConfidenceLevel(backendLevel);

    if (pct == null && normalized === "UNKNOWN") return "Pouzdanost: nepoznato";
    if (pct == null) return "Pouzdanost: ručno";
    return `Pouzdanost: ${pct}%`;
}

function hasConfidence(confidence: unknown, backendLevel?: unknown) {
    return confidenceValue(confidence) != null || normalizeConfidenceLevel(backendLevel) != null;
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

function lineDisplayName(line: EditableScanLine) {
    const name = String(line.itemName ?? "").trim();
    if (name && !/^Artikl\s+\d+$/i.test(name)) return name;

    const code = String(line.itemCode ?? line.slipItemCode ?? "").trim();
    return code ? `Šifra ${code}` : "Stavka";
}

function sourceLabel(source?: string | null) {
    const normalized = String(source ?? "").trim().toLowerCase();
    if (source === "DODATNI_TEKST" || normalized.includes("extra")) return "Dodatno";
    if (source === "RUCNO" || normalized.includes("manual")) return "Ručno";
    if (normalized.includes("layout") || normalized.includes("opencv")) return "Skenirano iz obrasca";
    if (normalized.includes("ocr")) return "Očitano OCR-om";
    return "Očitano";
}

function gridSourceLabel(source?: string | null) {
    const normalized = String(source ?? "").trim().toLowerCase();
    if (!normalized) return "nije dostupno";
    if (normalized.includes("known") || normalized.includes("layout") || normalized.includes("fixed")) return "poznati obrazac";
    if (normalized.includes("detected") || normalized.includes("grid")) return "prepoznata mreža";
    if (normalized.includes("fallback")) return "rezervna procjena";
    if (normalized.includes("opencv")) return "analiza slike";
    return "analiza slike";
}

function lineSubtitle(line: EditableScanLine) {
    return [
        line.itemCode ? `Šifra artikla: ${line.itemCode}` : null,
        line.slipItemCode ? `Šifra na otpremnici: ${line.slipItemCode}` : null,
        line.unit ? `JMJ: ${line.unit}` : null,
    ].filter(Boolean).join(" • ");
}

function linesFromParsed(parsed: DispatchSlipParsedDTO): EditableScanLine[] {
    return (((parsed as any)?.lines ?? []) as any[]).map((line) => ({
        slipItemCode: line?.slipItemCode ?? null,
        source: line?.source ?? null,
        documentId: cleanNumber(line?.documentId),
        itemId: cleanNumber(line?.itemId),
        itemCode: line?.itemCode ?? null,
        itemName: line?.itemName ?? null,
        unit: line?.unit ?? null,
        quantity: toQuantityInput(line?.quantity),
        itemResolved: line?.itemResolved ?? (cleanNumber(line?.itemId) != null),
        quantityValid: line?.quantityValid ?? Number(line?.quantity ?? 0) > 0,
        requiresManualItem: !!line?.requiresManualItem,
        requiresManualQuantity: !!line?.requiresManualQuantity,
        valid: line?.valid ?? null,
        warning: line?.warning ?? null,
        confidence: confidenceValue(line?.confidence),
        confidenceLevel: normalizeConfidenceLevel(line?.confidenceLevel),
    }));
}

function linesFromValidation(
    validation: BookingSessionScanValidateResponseDTO,
    previousLines?: EditableScanLine[]
): EditableScanLine[] {
    return (((validation as any)?.lines ?? []) as BookingSessionScanLineValidationDTO[]).map((line: any, index) => {
        const previous = previousLines?.[index];

        return {
            slipItemCode: line?.slipItemCode ?? previous?.slipItemCode ?? null,
            source: line?.source ?? previous?.source ?? null,
            documentId: cleanNumber(line?.documentId),
            itemId: cleanNumber(line?.itemId),
            itemCode: line?.itemCode ?? previous?.itemCode ?? null,
            itemName: line?.itemName ?? previous?.itemName ?? null,
            unit: line?.unit ?? previous?.unit ?? null,
            quantity: toQuantityInput(line?.quantity ?? previous?.quantity),
            itemResolved: !!line?.itemResolved,
            quantityValid: !!line?.quantityValid,
            requiresManualItem: !!line?.requiresManualItem,
            requiresManualQuantity: !!line?.requiresManualQuantity,
            valid: !!line?.valid,
            warning: line?.warning ?? null,
            confidence: confidenceValue(line?.confidence ?? previous?.confidence),
            confidenceLevel: normalizeConfidenceLevel(line?.confidenceLevel ?? previous?.confidenceLevel),
        };
    });
}

function makeValidationKey(page: Pick<ScanPage, "partnerId" | "templateId" | "documentDate" | "note" | "lines">) {
    return JSON.stringify({
        partnerId: page.partnerId,
        templateId: page.templateId,
        documentDate: page.documentDate,
        note: page.note,
        lines: page.lines.map((line) => ({
            documentId: cleanNumber(line.documentId),
            slipItemCode: String(line.slipItemCode ?? ""),
            source: String(line.source ?? ""),
            itemId: cleanNumber(line.itemId),
            itemCode: String(line.itemCode ?? ""),
            quantity: quantityValue(line),
            confidence: confidenceValue(line.confidence),
            confidenceLevel: normalizeConfidenceLevel(line.confidenceLevel),
        })),
    });
}

function isPageValidated(page: ScanPage) {
    return !!page.validatedKey && page.validatedKey === makeValidationKey(page) && !!page.lastValidation?.allValid;
}

function assuranceStyle(level: AssuranceLevel) {
    if (level === "high") return s.assuranceHigh;
    if (level === "medium") return s.assuranceMedium;
    return s.assuranceLow;
}

function assuranceText(level: AssuranceLevel) {
    if (level === "high") return "Spremno";
    if (level === "medium") return "Provjeriti";
    return "Treba ispravak";
}

function pageStats(page: ScanPage | null) {
    const lines = page?.lines ?? [];
    const total = lines.length;
    const linked = lines.filter((line) => cleanNumber(line.itemId)).length;
    const positive = lines.filter((line) => quantityValue(line) > 0).length;
    const ready = lines.filter((line) => quantityValue(line) > 0 && cleanNumber(line.itemId)).length;
    const unresolved = lines.filter((line) => quantityValue(line) > 0 && !cleanNumber(line.itemId)).length;
    const missingQuantities = lines.filter((line) => cleanNumber(line.itemId) && quantityValue(line) <= 0).length;
    const warnings = lines.filter((line) => !!line.warning).length;
    const lowConfidence = lines.filter(
        (line) => quantityValue(line) > 0 && confidenceLevelFromValues(line.confidence, line.confidenceLevel) === "low"
    ).length;
    const validated = page ? isPageValidated(page) : false;

    const level: AssuranceLevel = validated
        ? "high"
        : unresolved || warnings || lowConfidence
            ? "low"
            : linked || positive
                ? "medium"
                : "medium";

    const percent = total ? Math.round((linked / total) * 100) : 0;
    return { total, positive, linked, ready, unresolved, missingQuantities, warnings, lowConfidence, level, percent, validated };
}

function fileFromImageAsset(asset: ImagePicker.ImagePickerAsset): SelectedFile {
    return {
        uri: asset.uri,
        name: asset.fileName || `otpremnica-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
        width: asset.width,
        height: asset.height,
    };
}

function fileFromCameraPhoto(photo: { uri: string; width?: number | null; height?: number | null }): SelectedFile {
    return {
        uri: photo.uri,
        name: `otpremnica-${Date.now()}.jpg`,
        mimeType: "image/jpeg",
        width: photo.width ?? null,
        height: photo.height ?? null,
    };
}

function fileFromDocumentAsset(asset: DocumentPicker.DocumentPickerAsset): SelectedFile {
    return {
        uri: asset.uri,
        name: asset.name || `otpremnica-${Date.now()}`,
        mimeType: asset.mimeType || "application/octet-stream",
        width: null,
        height: null,
    };
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
    const lockedPartnerContext = !!initialPartnerId;

    const sessionQ = useBookingSession(sessionId);
    const parseM = useParseDispatchSlip();
    const validateM = useValidateDispatchSlipScan(sessionId);
    const saveM = useSaveDispatchSlipScanEntry(sessionId);

    const [pages, setPages] = useState<ScanPage[]>([]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [screenError, setScreenError] = useState<string | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [itemPickerIndex, setItemPickerIndex] = useState<number | null>(null);
    const [partnerPickerOpen, setPartnerPickerOpen] = useState(false);
    const [pickingAction, setPickingAction] = useState<PickingAction>(null);
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [scannerSession, setScannerSession] = useState<ScannerSession | null>(null);
    const cameraRef = useRef<any>(null);

    const analysisPulse = useMemo(() => new Animated.Value(0), []);
    const analysisTranslate = useMemo(
        () => analysisPulse.interpolate({ inputRange: [0, 1], outputRange: [-140, 520] }),
        [analysisPulse]
    );

    const currentPage = pages[currentPageIndex] ?? null;
    const warehouseId = cleanNumber((sessionQ.data as any)?.warehouseId);
    const analyzing = parseM.isPending || validateM.isPending;
    const busy = analyzing || saveM.isPending || !!pickingAction;
    const totalSlides = pages.length + 1;
    const stats = useMemo(() => pageStats(currentPage), [currentPage]);
    const currentDateValue = useMemo(
        () => isoToDateLocal(currentPage?.documentDate) ?? todayLocalNoon(),
        [currentPage?.documentDate]
    );

    const openScanner = useCallback(async (mode: ScannerMode) => {
        setScreenError(null);
        setScannerSession({
            mode,
            capturedFile: null,
            ready: false,
            error: null,
        });

        if (!CameraView) {
            setScannerSession({
                mode,
                capturedFile: null,
                ready: false,
                error: "Modul kamere za skeniranje nije instaliran. Učitaj sliku iz galerije ili instaliraj modul kamere.",
            });
            return;
        }

        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            setScannerSession({
                mode,
                capturedFile: null,
                ready: false,
                error: "Kamera nije dopuštena.",
            });
        }
    }, []);

    const updatePage = useCallback((pageId: string, updater: (page: ScanPage) => ScanPage) => {
        setPages((prev) => prev.map((page) => (page.id === pageId ? updater(page) : page)));
    }, []);

    const invalidatePage = useCallback((pageId: string, patch: Partial<ScanPage>) => {
        updatePage(pageId, (page) => ({
            ...page,
            ...patch,
            validatedKey: null,
            lastValidation: null,
        }));
    }, [updatePage]);

    const makePage = useCallback((file: SelectedFile): ScanPage => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        parsed: null,
        partnerId: initialPartnerId,
        selectedPartner: null,
        partnerNameHint: routePartnerNameHint,
        templateId: initialTemplateId,
        documentDate: "",
        note: "Skenirano sa papira",
        rawText: "",
        partnerConfidence: null,
        documentDateConfidence: null,
        lines: [],
        validatedKey: null,
        lastValidation: null,
        imageLoading: file.mimeType.startsWith("image/"),
    }), [initialPartnerId, initialTemplateId, routePartnerNameHint]);

    const resetPageForFile = useCallback((page: ScanPage, file: SelectedFile): ScanPage => ({
        ...page,
        file,
        parsed: null,
        rawText: "",
        partnerConfidence: null,
        documentDateConfidence: null,
        lines: [],
        validatedKey: null,
        lastValidation: null,
        imageLoading: file.mimeType.startsWith("image/"),
    }), []);

    useEffect(() => {
        const running = analyzing;

        if (!running) {
            analysisPulse.stopAnimation();
            analysisPulse.setValue(0);
            return;
        }

        const animation = Animated.loop(
            Animated.timing(analysisPulse, {
                toValue: 1,
                duration: 1200,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
            })
        );

        animation.start();
        return () => animation.stop();
    }, [analysisPulse, analyzing]);

    useEffect(() => {
        if (!currentPage?.partnerId || currentPage.selectedPartner) return;

        let alive = true;
        const controller = new AbortController();

        partnerService
            .getPartner(currentPage.partnerId, controller.signal)
            .then((partner) => {
                if (!alive) return;

                updatePage(currentPage.id, (page) => ({
                    ...page,
                    selectedPartner: partner,
                    partnerNameHint: cleanParamText((partner as any)?.name) ?? page.partnerNameHint,
                }));
            })
            .catch(() => {});

        return () => {
            alive = false;
            controller.abort();
        };
    }, [currentPage?.id, currentPage?.partnerId, currentPage?.selectedPartner, updatePage]);

    useEffect(() => {
        setDatePickerOpen(false);
    }, [currentPage?.id]);

    const onDocumentDateChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
        if (Platform.OS === "android") {
            setDatePickerOpen(false);
        }

        if (event.type === "dismissed" || !currentPage || !date) {
            return;
        }

        const selected = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);

        invalidatePage(currentPage.id, {
            documentDate: dateToIsoLocal(selected),
            documentDateConfidence: 1,
        });
    }, [currentPage, invalidatePage]);

    const pickCamera = useCallback(async () => {
        await openScanner("add");
    }, [openScanner]);

    const retakeCurrentPage = useCallback(async () => {
        if (!currentPage) return;

        await openScanner("replace");
    }, [currentPage, openScanner]);

    const removePage = useCallback((index: number) => {
        const nextPages = pages.filter((_, i) => i !== index);

        setPages(nextPages);
        setCurrentPageIndex(Math.max(0, Math.min(currentPageIndex, nextPages.length - 1)));
        setScreenError(null);
    }, [currentPageIndex, pages]);

    const updateLine = useCallback((index: number, patch: Partial<EditableScanLine>) => {
        if (!currentPage) return;

        invalidatePage(currentPage.id, {
            lines: currentPage.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
        });
    }, [currentPage, invalidatePage]);

    const removeLine = useCallback((index: number) => {
        if (!currentPage) return;

        invalidatePage(currentPage.id, {
            lines: currentPage.lines.filter((_, i) => i !== index),
        });
    }, [currentPage, invalidatePage]);

    const addManualLine = useCallback(() => {
        if (!currentPage) return;

        invalidatePage(currentPage.id, {
            lines: [
                ...currentPage.lines,
                {
                    source: "RUCNO",
                    quantity: "",
                    valid: null,
                    itemResolved: false,
                    quantityValid: false,
                    confidence: null,
                    confidenceLevel: "UNKNOWN",
                },
            ],
        });

        setItemPickerIndex(currentPage.lines.length);
    }, [currentPage, invalidatePage]);

    const applyParsed = useCallback((pageId: string, next: DispatchSlipParsedDTO) => {
        const nextLines = linesFromParsed(next);

        updatePage(pageId, (page) => {
            const nextPartnerId = cleanNumber((next as any)?.partnerId) ?? page.partnerId;
            const nextTemplateId = cleanNumber((next as any)?.templateId) ?? page.templateId;
            const nextDate = toDateInput((next as any)?.documentDate ?? page.documentDate);
            const nextNote = String((next as any)?.note ?? page.note ?? "");
            const rawText = String((next as any)?.rawText ?? page.rawText ?? "");
            const partnerHint =
                cleanParamText((next as any)?.partnerName) ??
                cleanParamText((next as any)?.detectedPartnerText) ??
                page.partnerNameHint;

            const keyPage = {
                partnerId: nextPartnerId,
                templateId: nextTemplateId,
                documentDate: nextDate,
                note: nextNote,
                lines: nextLines,
            };

            return {
                ...page,
                parsed: next,
                partnerId: nextPartnerId,
                templateId: nextTemplateId,
                documentDate: nextDate,
                note: nextNote,
                rawText,
                partnerConfidence: confidenceValue((next as any)?.partnerConfidence),
                documentDateConfidence: confidenceValue((next as any)?.documentDateConfidence),
                partnerNameHint: partnerHint,
                lines: nextLines,
                validatedKey: (next as any)?.allValid ? makeValidationKey(keyPage) : null,
                lastValidation: (next as any)?.allValid ? {
                    sessionId,
                    partnerId: nextPartnerId as any,
                    partnerName: (next as any)?.partnerName as any,
                    templateId: nextTemplateId as any,
                    documentDate: nextDate as any,
                    partnerResolved: (nextPartnerId != null) as any,
                    requiresManualPartner: (nextPartnerId == null) as any,
                    allValid: true,
                    lines: nextLines as any,
                } : null,
            };
        });
    }, [sessionId, updatePage]);

    const buildValidatePayload = useCallback((page: ScanPage) => ({
        partnerId: page.partnerId as any,
        templateId: (page.templateId || null) as any,
        documentDate: nullableDateInput(page.documentDate) as any,
        note: page.note,
        lines: page.lines.map((line) => {
            const quantity = quantityValue(line);

            return {
                documentId: cleanNumber(line.documentId) as any,
                slipItemCode: line.slipItemCode ?? undefined,
                source: line.source ?? undefined,
                itemId: cleanNumber(line.itemId) as any,
                itemCode: line.itemCode ?? undefined,
                itemName: line.itemName ?? undefined,
                unit: line.unit ?? undefined,
                quantity: quantity > 0 ? quantity : null,
                confidence: confidenceValue(line.confidence) as any,
                confidenceLevel: normalizeConfidenceLevel(line.confidenceLevel) as any,
            };
        }) as any,
    }), []);

    const analyzePage = useCallback(async (pageToAnalyze: ScanPage) => {
        try {
            setScreenError(null);

            const result = await parseM.mutateAsync({
                sessionId,
                uri: pageToAnalyze.file.uri,
                name: pageToAnalyze.file.name,
                mimeType: pageToAnalyze.file.mimeType,
                partnerId: pageToAnalyze.partnerId,
                templateId: pageToAnalyze.templateId,
                documentDate: pageToAnalyze.documentDate || null,
                note: pageToAnalyze.note || null,
            });

            applyParsed(pageToAnalyze.id, result);
        } catch (e) {
            updatePage(pageToAnalyze.id, (page) => ({ ...page, validatedKey: null, lastValidation: null }));
            setScreenError(toUserMessage(e, "Greška pri analizi otpremnice."));
        }
    }, [applyParsed, parseM, sessionId, updatePage]);

    const parseCurrentPage = useCallback(async () => {
        if (!currentPage) return;
        await analyzePage(currentPage);
    }, [analyzePage, currentPage]);

    const appendFilesAndAnalyze = useCallback((files: SelectedFile[]) => {
        if (!files.length) return;

        const startIndex = pages.length;
        const nextPages = files.map(makePage);

        setPages((prev) => [...prev, ...nextPages]);
        setCurrentPageIndex(startIndex);
        setScreenError(null);

        void (async () => {
            for (const page of nextPages) {
                await analyzePage(page);
            }
        })();
    }, [analyzePage, makePage, pages.length]);

    const replaceCurrentFileAndAnalyze = useCallback((file: SelectedFile) => {
        if (!currentPage) return;

        const nextPage = resetPageForFile(currentPage, file);
        setPages((prev) => prev.map((page) => (page.id === currentPage.id ? nextPage : page)));
        setScreenError(null);
        void analyzePage(nextPage);
    }, [analyzePage, currentPage, resetPageForFile]);

    const pickDocument = useCallback(async () => {
        setScreenError(null);
        setPickingAction("addFile");

        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: "image/*",
                copyToCacheDirectory: true,
                multiple: true,
            });

            if (res.canceled || !res.assets?.length) return;
            appendFilesAndAnalyze(res.assets.map(fileFromDocumentAsset));
        } finally {
            setPickingAction(null);
        }
    }, [appendFilesAndAnalyze]);

    const reuploadCurrentPage = useCallback(async () => {
        if (!currentPage) return;

        setScreenError(null);
        setPickingAction("replaceFile");

        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: "image/*",
                copyToCacheDirectory: true,
                multiple: false,
            });

            if (res.canceled || !res.assets?.[0]) return;
            replaceCurrentFileAndAnalyze(fileFromDocumentAsset(res.assets[0]));
        } finally {
            setPickingAction(null);
        }
    }, [currentPage, replaceCurrentFileAndAnalyze]);

    const commitScannerFile = useCallback((file: SelectedFile) => {
        const mode = scannerSession?.mode ?? "add";

        if (mode === "replace" && currentPage) {
            const nextPage = resetPageForFile(currentPage, file);
            setPages((prev) => prev.map((page) => (page.id === currentPage.id ? nextPage : page)));
            setScreenError(null);
            setScannerSession(null);
            void analyzePage(nextPage);
            return;
        }

        const nextPage = makePage(file);
        setPages((prev) => {
            setCurrentPageIndex(prev.length);
            return [...prev, nextPage];
        });
        setScreenError(null);
        setScannerSession(null);
        void analyzePage(nextPage);
    }, [analyzePage, currentPage, makePage, resetPageForFile, scannerSession?.mode]);

    const captureScannerPhoto = useCallback(async () => {
        if (!scannerSession || scannerSession.error || scannerSession.capturedFile) return;

        try {
            setPickingAction(scannerSession.mode === "replace" ? "replaceCamera" : "addCamera");
            const photo = await cameraRef.current?.takePictureAsync?.({
                quality: 0.92,
                skipProcessing: false,
            });

            if (!photo?.uri) {
                setScannerSession((current) => current ? { ...current, error: "Nije moguće snimiti sliku. Pokušaj ponovno." } : current);
                return;
            }

            setScannerSession((current) => current ? {
                ...current,
                capturedFile: fileFromCameraPhoto(photo),
                error: null,
            } : current);
        } catch {
            setScannerSession((current) => current ? { ...current, error: "Nije moguće snimiti sliku. Pokušaj ponovno." } : current);
        } finally {
            setPickingAction(null);
        }
    }, [scannerSession]);

    const pickGalleryFromScanner = useCallback(async () => {
        if (!scannerSession) return;

        setScreenError(null);
        setPickingAction(scannerSession.mode === "replace" ? "replaceFile" : "addFile");

        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: "image/*",
                copyToCacheDirectory: true,
                multiple: false,
            });

            if (res.canceled || !res.assets?.[0]) return;
            commitScannerFile(fileFromDocumentAsset(res.assets[0]));
        } finally {
            setPickingAction(null);
        }
    }, [commitScannerFile, scannerSession]);

    const validateCurrentPage = useCallback(async () => {
        if (!currentPage) return;

        try {
            setScreenError(null);

            const res = await validateM.mutateAsync(buildValidatePayload(currentPage));
            const nextLines = linesFromValidation(res, currentPage.lines);
            const nextDate = toDateInput((res as any)?.documentDate ?? currentPage.documentDate);
            const nextPartnerName = cleanParamText((res as any)?.partnerName);

            updatePage(currentPage.id, (page) => {
                const nextPage = {
                    ...page,
                    lines: nextLines,
                    documentDate: nextDate,
                    partnerNameHint: nextPartnerName ?? page.partnerNameHint,
                    lastValidation: res,
                };

                return {
                    ...nextPage,
                    validatedKey: res.allValid ? makeValidationKey(nextPage) : null,
                };
            });
        } catch (e) {
            updatePage(currentPage.id, (page) => ({ ...page, validatedKey: null, lastValidation: null }));
            setScreenError(toUserMessage(e, "Greška pri validaciji stranice."));
        }
    }, [buildValidatePayload, currentPage, updatePage, validateM]);

    const parseOrValidate = useCallback(async () => {
        if (!currentPage) return;

        if (currentPage.parsed) {
            await validateCurrentPage();
            return;
        }

        await parseCurrentPage();
    }, [currentPage, parseCurrentPage, validateCurrentPage]);

    const pickPartnerForScan = useCallback((partner: PartnerResponseDTO, close: () => void) => {
        if (!currentPage) return;

        const nextPartnerId = cleanNumber((partner as any)?.id);
        if (!nextPartnerId) return;

        invalidatePage(currentPage.id, {
            partnerId: nextPartnerId,
            selectedPartner: partner,
            partnerNameHint: cleanParamText((partner as any)?.name),
            partnerConfidence: 1,
        });

        setScreenError(null);
        close();
    }, [currentPage, invalidatePage]);

    const pickItemForLine = useCallback((item: ItemDescriptorResponseDTO, close: () => void) => {
        if (!currentPage || itemPickerIndex == null) return;

        const selectedItemId = cleanNumber((item as any)?.itemId ?? (item as any)?.id);
        if (!selectedItemId) return;

        updateLine(itemPickerIndex, {
            itemId: selectedItemId,
            itemName: itemTitle(item),
            itemCode: itemCode(item) || null,
            unit: String((item as any)?.unit ?? "").trim() || null,
            itemResolved: true,
            requiresManualItem: false,
            valid: null,
            warning: null,
        });

        setItemPickerIndex(null);
        close();
    }, [currentPage, itemPickerIndex, updateLine]);

    const currentValidationError = useMemo(() => {
        if (!currentPage) return pages.length ? null : "Dodaj barem jednu stranicu otpremnice.";
        if (!currentPage.parsed) return "Analiziraj stranicu prije spremanja.";
        if (!currentPage.partnerId) return "Odaberi partnera prije spremanja.";
        if (!currentPage.lines.some((line) => quantityValue(line) > 0)) return "Unesi barem jednu pozitivnu količinu.";
        if (!isPageValidated(currentPage)) return "Nakon izmjena ponovno validiraj stranicu.";
        return null;
    }, [currentPage, pages.length]);

    const saveAllError = useMemo(() => {
        if (!pages.length) return "Dodaj barem jednu stranicu otpremnice.";

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const hasPositive = page.lines.some((line) => quantityValue(line) > 0);

            if (!page.parsed) return `Stranica ${i + 1}: prvo pokreni analizu.`;
            if (!page.partnerId) return `Stranica ${i + 1}: odaberi partnera.`;
            if (!hasPositive) return `Stranica ${i + 1}: unesi barem jednu količinu.`;
            if (!isPageValidated(page)) return `Stranica ${i + 1}: ponovno validiraj nakon izmjena.`;
        }

        return null;
    }, [pages]);

    const saveAll = useCallback(async () => {
        if (saveAllError) return;

        const groups = new Map<number, {
            partnerId: number;
            partnerNameHint: string | null;
            templateId: number | null;
            documentDate: string;
            notes: string[];
            lines: any[];
        }>();

        for (const page of pages) {
            const partnerId = page.partnerId;
            if (!partnerId) continue;

            const group = groups.get(partnerId) ?? {
                partnerId,
                partnerNameHint: page.partnerNameHint,
                templateId: page.templateId,
                documentDate: page.documentDate,
                notes: [],
                lines: [],
            };

            if (group.templateId !== page.templateId) {
                group.templateId = null;
            }

            if (page.note?.trim() && !group.notes.includes(page.note.trim())) {
                group.notes.push(page.note.trim());
            }

            group.lines.push(...page.lines
                .filter((line) => quantityValue(line) > 0)
                .map((line) => ({
                    documentId: cleanNumber(line.documentId) as any,
                    slipItemCode: line.slipItemCode ?? undefined,
                    source: line.source ?? undefined,
                    itemId: cleanNumber(line.itemId) as any,
                    itemCode: line.itemCode ?? undefined,
                    itemName: line.itemName ?? undefined,
                    unit: line.unit ?? undefined,
                    quantity: quantityValue(line),
                }))
                .filter((line) => line.itemId && line.quantity > 0));

            groups.set(partnerId, group);
        }

        try {
            setScreenError(null);

            for (const group of groups.values()) {
                await saveM.mutateAsync({
                    partnerId: group.partnerId,
                    templateId: (group.templateId || null) as any,
                    draftMode: "FINAL" as any,
                    documentDate: nullableDateInput(group.documentDate) as any,
                    note: group.notes.join("\n"),
                    lines: group.lines as any,
                });
            }

            if (lockedPartnerContext && initialPartnerId && groups.size === 1) {
                router.replace({
                    pathname: "/(tabs)/sessions/[id]/entry" as const,
                    params: {
                        id: String(sessionId),
                        partnerId: String(initialPartnerId),
                        partnerName: routePartnerNameHint || undefined,
                    },
                });
                return;
            }

            router.replace({ pathname: "/(tabs)/sessions/[id]" as const, params: { id: String(sessionId) } });
        } catch (e) {
            setScreenError(toUserMessage(e, "Greška pri spremanju stranica."));
        }
    }, [initialPartnerId, lockedPartnerContext, pages, routePartnerNameHint, saveAllError, saveM, sessionId]);

    const goBackToPreviousContext = useCallback(() => {
        if (lockedPartnerContext && initialPartnerId) {
            router.replace({
                pathname: "/(tabs)/sessions/[id]/entry" as const,
                params: {
                    id: String(sessionId),
                    partnerId: String(initialPartnerId),
                    partnerName: routePartnerNameHint || undefined,
                },
            });
            return;
        }

        router.replace({ pathname: "/(tabs)/sessions/[id]" as const, params: { id: String(sessionId) } });
    }, [initialPartnerId, lockedPartnerContext, routePartnerNameHint, sessionId]);

    const actionLabel = parseM.isPending
        ? "Analiziram..."
        : validateM.isPending
            ? "Validiram..."
            : currentPage?.parsed
                ? currentPage.lastValidation
                    ? "Ponovno validiraj stranicu"
                    : "Validiraj stranicu"
                : "Analiziraj stranicu";

    const currentPartnerLabel = partnerLabel(
        currentPage?.selectedPartner ?? null,
        currentPage?.partnerId ?? null,
        currentPage?.partnerNameHint
    );

    return (
        <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
            <View style={s.wrap}>
                <NavigationHeader title="Skeniraj otpremnicu" onBackPress={goBackToPreviousContext} />

                <SearchPickerSheet<PartnerResponseDTO>
                    visible={partnerPickerOpen}
                    title="Odaberi partnera"
                    onClose={() => setPartnerPickerOpen(false)}
                    keyOf={(partner) => String((partner as any)?.id)}
                    queryKeyBase={["scan-partners"]}
                    queryPage={({ page, size, q, signal }) =>
                        partnerService.pagePartners(
                            { page, size, q: q ?? "" },
                            signal
                        ).then((response) => ({
                            items: response.items ?? [],
                            page: Number(response.page ?? page),
                            size: Number(response.size ?? size),
                            total: Number(response.total ?? 0),
                        }))
                    }
                    searchPlaceholder="Pretraži partnere..."
                    renderRow={(partner, close) => (
                        <Pressable style={s.pickerRow} onPress={() => pickPartnerForScan(partner, close)}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.pickerTitle}>{(partner as any)?.name}</Text>
                                <Text style={s.pickerSub}>
                                    #{(partner as any)?.partnerNumber} • {(partner as any)?.city}
                                </Text>
                            </View>
                        </Pressable>
                    )}
                />

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
                        {!!currentPage?.file.uri && currentPage.file.mimeType.startsWith("image/") && (
                            <Image source={{ uri: currentPage.file.uri }} style={s.modalImage} resizeMode="contain" />
                        )}
                    </View>
                </Modal>

                <Modal
                    visible={!!scannerSession}
                    animationType="slide"
                    onRequestClose={() => setScannerSession(null)}
                >
                    <View style={s.scannerModalRoot}>
                        <View style={s.scannerModalHeader}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={s.scannerModalTitle}>Skeniraj otpremnicu</Text>
                                <Text style={s.scannerModalSub}>Poravnaj papir i potvrdi sliku prije analize.</Text>
                            </View>
                            <Pressable style={s.scannerCloseButton} onPress={() => setScannerSession(null)}>
                                <FontAwesome name="times" size={18} color="#fff" />
                            </Pressable>
                        </View>

                        <View style={s.liveScannerStage}>
                            {scannerSession?.capturedFile ? (
                                <Image
                                    source={{ uri: scannerSession.capturedFile.uri }}
                                    style={s.liveCamera}
                                    resizeMode="contain"
                                />
                            ) : CameraView && !scannerSession?.error ? (
                                <CameraView
                                    ref={cameraRef}
                                    style={s.liveCamera}
                                    facing="back"
                                    onCameraReady={() => setScannerSession((current) => current ? { ...current, ready: true } : current)}
                                />
                            ) : (
                                <View style={s.cameraFallback}>
                                    <FontAwesome name="camera" size={40} color="#fff" />
                                    <Text style={s.cameraFallbackText}>
                                        {scannerSession?.error || "Kamera trenutno nije dostupna."}
                                    </Text>
                                </View>
                            )}

                            <View style={s.liveGuideOverlay} pointerEvents="none">
                                <View style={s.liveGuideFrame}>
                                    <View style={s.guideHeaderLine} />
                                    <View style={s.guideGridTopLine} />
                                    <View style={s.guideGridBottomLine} />
                                </View>
                                <Text style={s.liveGuideText}>
                                    Poravnaj otpremnicu unutar okvira za bolje očitanje.
                                </Text>
                            </View>
                        </View>

                        {!!scannerSession?.error && (
                            <View style={s.scannerModalError}>
                                <FontAwesome name="warning" size={16} color="#fed7aa" />
                                <Text style={s.scannerModalErrorText}>{scannerSession.error}</Text>
                            </View>
                        )}

                        {scannerSession?.capturedFile ? (
                            <View style={s.scannerModalActions}>
                                <Pressable
                                    style={[s.scannerActionButton, s.scannerActionPrimary]}
                                    onPress={() => commitScannerFile(scannerSession.capturedFile!)}
                                    disabled={busy}
                                >
                                    <FontAwesome name="check" size={16} color="#fff" />
                                    <Text style={s.scannerActionPrimaryText}>Koristi sliku</Text>
                                </Pressable>
                                <Pressable
                                    style={s.scannerActionButton}
                                    onPress={() => setScannerSession((current) => current ? {
                                        ...current,
                                        capturedFile: null,
                                        ready: false,
                                        error: null,
                                    } : current)}
                                    disabled={busy}
                                >
                                    <FontAwesome name="camera" size={15} color="#fff" />
                                    <Text style={s.scannerActionText}>Slikaj ponovno</Text>
                                </Pressable>
                                <Pressable style={s.scannerActionButton} onPress={pickGalleryFromScanner} disabled={busy}>
                                    {pickingAction === "addFile" || pickingAction === "replaceFile" ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <FontAwesome name="upload" size={15} color="#fff" />
                                            <Text style={s.scannerActionText}>Učitaj iz galerije</Text>
                                        </>
                                    )}
                                </Pressable>
                            </View>
                        ) : (
                            <View style={s.scannerCaptureBar}>
                                <Pressable style={s.scannerSmallAction} onPress={pickGalleryFromScanner} disabled={busy}>
                                    {pickingAction === "addFile" || pickingAction === "replaceFile" ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <FontAwesome name="upload" size={15} color="#fff" />
                                            <Text style={s.scannerSmallActionText}>Galerija</Text>
                                        </>
                                    )}
                                </Pressable>
                                <Pressable
                                    style={[
                                        s.captureButton,
                                        (!scannerSession?.ready || !!scannerSession?.error || busy) && s.captureButtonDisabled,
                                    ]}
                                    onPress={captureScannerPhoto}
                                    disabled={!scannerSession?.ready || !!scannerSession?.error || busy}
                                >
                                    {pickingAction === "addCamera" || pickingAction === "replaceCamera" ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <View style={s.captureButtonInner} />
                                    )}
                                </Pressable>
                                <Pressable style={s.scannerSmallAction} onPress={() => setScannerSession(null)} disabled={busy}>
                                    <FontAwesome name="times" size={15} color="#fff" />
                                    <Text style={s.scannerSmallActionText}>Zatvori</Text>
                                </Pressable>
                            </View>
                        )}
                    </View>
                </Modal>

                <ScrollView
                    contentContainerStyle={s.content}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    onScrollBeginDrag={Keyboard.dismiss}
                >
                    {!!(screenError || sessionQ.error) && (
                        <ErrorCard
                            title="Greška"
                            message={screenError || toUserMessage(sessionQ.error, "Greška pri učitavanju podataka.")}
                            messageLines={0}
                            actionPlacement="bottom"
                            selectableMessage
                            onAction={() => {
                                if (screenError && currentPage) {
                                    setScreenError(null);
                                    void parseOrValidate();
                                    return;
                                }

                                setScreenError(null);
                                sessionQ.refetch();
                            }}
                        />
                    )}

                    <View style={s.card}>
                        <Text style={s.title}>Stranice otpremnice</Text>
                        <Text style={s.sub}>Dodaj jednu ili više stranica, provjeri partnera, količine i artikle, pa spremi sve zajedno.</Text>

                        <View style={s.scannerShell}>
                            <View style={s.scannerMain}>
                                {currentPage ? (
                                    <Pressable
                                        style={s.scannerPreview}
                                        onPress={() => currentPage.file.mimeType.startsWith("image/") && setPreviewOpen(true)}
                                    >
                                        {currentPage.file.mimeType.startsWith("image/") ? (
                                            <Image
                                                source={{ uri: currentPage.file.uri }}
                                                style={s.previewImage}
                                                resizeMode="contain"
                                                onLoadStart={() => updatePage(currentPage.id, (page) => ({ ...page, imageLoading: true }))}
                                                onLoadEnd={() => updatePage(currentPage.id, (page) => ({ ...page, imageLoading: false }))}
                                                onError={() => updatePage(currentPage.id, (page) => ({ ...page, imageLoading: false }))}
                                            />
                                        ) : (
                                            <View style={s.pdfPreview}>
                                                <FontAwesome name="file-pdf-o" size={34} color="#94a3b8" />
                                                <Text style={s.pdfPreviewText} numberOfLines={2}>{currentPage.file.name}</Text>
                                            </View>
                                        )}

                                        <View style={s.alignmentGuideOverlay} pointerEvents="none">
                                            <View style={s.alignmentGuideFrame}>
                                                <View style={s.guideHeaderLine} />
                                                <View style={s.guideGridTopLine} />
                                                <View style={s.guideGridBottomLine} />
                                            </View>
                                            <Text style={s.alignmentGuideText}>
                                                Poravnaj otpremnicu unutar okvira za bolje očitanje.
                                            </Text>
                                        </View>

                                        {currentPage.imageLoading && (
                                            <View style={s.previewLoading} pointerEvents="none">
                                                <ActivityIndicator />
                                                <Text style={s.previewLoadingText}>Učitavam sliku...</Text>
                                            </View>
                                        )}

                                        {analyzing && (
                                            <View style={s.imageScanOverlay} pointerEvents="none">
                                                <Animated.View style={[s.imageScanBeam, { transform: [{ translateY: analysisTranslate }] }]} />
                                            </View>
                                        )}

                                        <Pressable
                                            style={s.deletePageButton}
                                            onPress={() => removePage(currentPageIndex)}
                                            disabled={busy}
                                        >
                                            <FontAwesome name="trash" size={16} color="#fff" />
                                        </Pressable>

                                        <View style={s.replacePageActions}>
                                            <Pressable
                                                style={s.replacePageButton}
                                                onPress={retakeCurrentPage}
                                                disabled={busy}
                                            >
                                                {pickingAction === "replaceCamera" ? (
                                                    <ActivityIndicator />
                                                ) : (
                                                    <>
                                                        <FontAwesome name="camera" size={14} color={Colors.text} />
                                                        <Text style={s.replacePageButtonText}>Slikaj ponovno</Text>
                                                    </>
                                                )}
                                            </Pressable>
                                            <Pressable
                                                style={s.replacePageButton}
                                                onPress={reuploadCurrentPage}
                                                disabled={busy}
                                            >
                                                {pickingAction === "replaceFile" ? (
                                                    <ActivityIndicator />
                                                ) : (
                                                    <>
                                                        <FontAwesome name="upload" size={14} color={Colors.text} />
                                                        <Text style={s.replacePageButtonText}>Učitaj drugi</Text>
                                                    </>
                                                )}
                                            </Pressable>
                                        </View>
                                    </Pressable>
                                ) : (
                                    <View style={s.emptyScanner}>
                                        <View style={s.emptyScannerIcon}>
                                            <FontAwesome name="camera" size={36} color={Colors.orange} />
                                        </View>
                                        <Text style={s.emptyScannerTitle}>
                                            {pages.length ? "Dodaj novu stranicu" : "Nema dodanih stranica"}
                                        </Text>
                                        <Text style={s.emptyScannerText}>
                                            {pages.length
                                                ? "Slikaj ili učitaj još jednu stranicu otpremnice."
                                                : "Slikaj ili učitaj datoteke za obradu."}
                                        </Text>
                                        <View style={s.emptyGuideWrap} pointerEvents="none">
                                            <View style={s.emptyGuideFrame}>
                                                <View style={s.guideHeaderLine} />
                                                <View style={s.guideGridTopLine} />
                                                <View style={s.guideGridBottomLine} />
                                            </View>
                                            <Text style={s.emptyGuideText}>
                                                Poravnaj otpremnicu unutar okvira za bolje očitanje.
                                            </Text>
                                        </View>
                                        <View style={s.emptyScannerActions}>
                                            <Pressable style={s.emptyScannerButton} onPress={pickCamera} disabled={busy}>
                                                {pickingAction === "addCamera" ? (
                                                    <ActivityIndicator />
                                                ) : (
                                                    <>
                                                        <FontAwesome name="camera" size={18} color="#fff" />
                                                        <Text style={s.emptyScannerPrimaryText}>Slikaj</Text>
                                                    </>
                                                )}
                                            </Pressable>
                                            <Pressable style={s.emptyScannerSecondaryButton} onPress={pickDocument} disabled={busy}>
                                                {pickingAction === "addFile" ? (
                                                    <ActivityIndicator />
                                                ) : (
                                                    <>
                                                        <FontAwesome name="upload" size={17} color={Colors.text} />
                                                        <Text style={s.emptyScannerSecondaryText}>Učitaj</Text>
                                                    </>
                                                )}
                                            </Pressable>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>

                        <View style={s.pageNav}>
                            <Pressable
                                style={s.pageNavButton}
                                onPress={() => setCurrentPageIndex((x) => Math.max(0, x - 1))}
                                disabled={busy || currentPageIndex <= 0}
                            >
                                <FontAwesome name="chevron-left" size={22} color={currentPageIndex <= 0 ? "#94a3b8" : Colors.text} />
                            </Pressable>
                            <View style={s.pageCountPill}>
                                <Text style={s.pageCount}>
                                    {currentPage ? `${currentPageIndex + 1}/${totalSlides}` : `Dodaj • ${currentPageIndex + 1}/${totalSlides}`}
                                </Text>
                            </View>
                            <Pressable
                                style={s.pageNavButton}
                                onPress={() => setCurrentPageIndex((x) => Math.min(pages.length, x + 1))}
                                disabled={busy || currentPageIndex >= pages.length}
                            >
                                <FontAwesome name="chevron-right" size={22} color={currentPageIndex >= pages.length ? "#94a3b8" : Colors.text} />
                            </Pressable>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.thumbRail}>
                            {pages.map((page, index) => (
                                <Pressable
                                    key={page.id}
                                    style={[s.pageThumb, index === currentPageIndex && s.pageThumbActive]}
                                    onPress={() => setCurrentPageIndex(index)}
                                    disabled={busy}
                                >
                                    {page.file.mimeType.startsWith("image/") ? (
                                        <Image source={{ uri: page.file.uri }} style={s.pageThumbImage} resizeMode="cover" />
                                    ) : (
                                        <FontAwesome name="file-pdf-o" size={18} color="#64748b" />
                                    )}
                                    <Text style={s.pageThumbText}>{index + 1}</Text>
                                </Pressable>
                            ))}
                            <Pressable
                                style={[s.pageThumbAdd, currentPageIndex === pages.length && s.pageThumbAddActive]}
                                onPress={() => setCurrentPageIndex(pages.length)}
                                disabled={busy}
                            >
                                <FontAwesome name="plus" size={20} color={Colors.orange} />
                            </Pressable>
                        </ScrollView>

                        <View style={s.actions}>
                            <Pressable style={s.secondary} onPress={pickCamera} disabled={busy}>
                                {pickingAction === "addCamera" ? <ActivityIndicator /> : <Text style={s.secondaryText}>Slikaj</Text>}
                            </Pressable>
                            <Pressable style={s.secondary} onPress={pickDocument} disabled={busy}>
                                {pickingAction === "addFile" ? <ActivityIndicator /> : <Text style={s.secondaryText}>Učitaj datoteke</Text>}
                            </Pressable>
                        </View>

                        <PrimaryButton
                            label={actionLabel}
                            onPress={parseOrValidate}
                            loading={analyzing}
                            disabled={!currentPage || busy || currentPage.imageLoading}
                        />
                    </View>

                    {!!currentPage?.parsed && (
                        <>
                            <View style={s.card}>
                                <View style={s.assuranceHeader}>
                                    <View>
                                        <Text style={s.title}>Provjera stranice</Text>
                                        <Text style={s.sub}>
                                            Provjera s poslužitelja
                                            {(currentPage.parsed as any)?.processingMs ? ` • ${(currentPage.parsed as any).processingMs} ms` : ""}
                                        </Text>
                                    </View>
                                    <View style={[s.assurancePill, assuranceStyle(stats.level)]}>
                                        <Text style={s.assurancePillText}>{assuranceText(stats.level)}</Text>
                                    </View>
                                </View>

                                <View style={s.scoreRow}>
                                    <View style={s.scoreCircle}>
                                        <Text style={s.scoreNumber}>{stats.percent}%</Text>
                                        <Text style={s.scoreLabel}>povezano</Text>
                                    </View>
                                    <View style={s.scoreDetails}>
                                        <View style={s.metricRow}>
                                            <Text style={s.metricLabel}>Redova na stranici</Text>
                                            <Text style={s.metricValue}>{stats.total}</Text>
                                        </View>
                                        <View style={s.metricRow}>
                                            <Text style={s.metricLabel}>Povezano artikala</Text>
                                            <Text style={[s.metricValue, stats.linked === stats.total && stats.total ? s.metricHigh : s.metricMedium]}>
                                                {stats.linked}/{stats.total}
                                            </Text>
                                        </View>
                                        <View style={s.metricRow}>
                                            <Text style={s.metricLabel}>Količina pronađeno</Text>
                                            <Text style={s.metricValue}>{stats.positive}</Text>
                                        </View>
                                        <View style={s.metricRow}>
                                            <Text style={s.metricLabel}>Spremno za unos</Text>
                                            <Text style={[s.metricValue, stats.ready ? s.metricHigh : s.metricMedium]}>{stats.ready}</Text>
                                        </View>
                                        <View style={s.metricRow}>
                                            <Text style={s.metricLabel}>Nedostaje količina</Text>
                                            <Text style={[s.metricValue, stats.missingQuantities ? s.metricMedium : s.metricHigh]}>
                                                {stats.missingQuantities}
                                            </Text>
                                        </View>
                                        <View style={s.metricRow}>
                                            <Text style={s.metricLabel}>Niska pouzdanost</Text>
                                            <Text style={[s.metricValue, stats.lowConfidence ? s.metricMedium : s.metricHigh]}>
                                                {stats.lowConfidence}
                                            </Text>
                                        </View>
                                        <View style={s.metricRow}>
                                            <Text style={s.metricLabel}>Artikl ručno riješiti</Text>
                                            <Text style={[s.metricValue, stats.unresolved ? s.metricLow : s.metricHigh]}>
                                                {stats.unresolved}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {!!(currentPage.parsed as any)?.imageQuality && (
                                    <View style={s.qualityBox}>
                                        <View style={s.qualityHeader}>
                                            <FontAwesome name="image" size={15} color={Colors.text} />
                                            <Text style={s.qualityTitle}>Kvaliteta očitanja</Text>
                                        </View>
                                        <View style={s.qualityGrid}>
                                            <View style={s.qualityMetric}>
                                                <Text style={s.qualityLabel}>Oštrina</Text>
                                                <Text style={s.qualityValue}>
                                                    {metricNumber((currentPage.parsed as any).imageQuality.blurScore, 0)}
                                                </Text>
                                            </View>
                                            <View style={s.qualityMetric}>
                                                <Text style={s.qualityLabel}>Svjetlina</Text>
                                                <Text style={s.qualityValue}>
                                                    {metricNumber((currentPage.parsed as any).imageQuality.brightness, 0)}
                                                </Text>
                                            </View>
                                            <View style={s.qualityMetric}>
                                                <Text style={s.qualityLabel}>Kontrast</Text>
                                                <Text style={s.qualityValue}>
                                                    {metricNumber((currentPage.parsed as any).imageQuality.contrast, 0)}
                                                </Text>
                                            </View>
                                            <View style={s.qualityMetric}>
                                                <Text style={s.qualityLabel}>Papir</Text>
                                                <Text style={[
                                                    s.qualityValue,
                                                    lowConfidence((currentPage.parsed as any).imageQuality.paperDetectionConfidence) && s.metricLow,
                                                ]}>
                                                    {metricPercent((currentPage.parsed as any).imageQuality.paperDetectionConfidence)}
                                                </Text>
                                            </View>
                                            <View style={s.qualityMetric}>
                                                <Text style={s.qualityLabel}>Mreža</Text>
                                                <Text style={[
                                                    s.qualityValue,
                                                    lowConfidence((currentPage.parsed as any).imageQuality.gridDetectionConfidence) && s.metricLow,
                                                ]}>
                                                    {metricPercent((currentPage.parsed as any).imageQuality.gridDetectionConfidence)}
                                                </Text>
                                            </View>
                                            <View style={s.qualityMetric}>
                                                <Text style={s.qualityLabel}>Polja</Text>
                                                <Text style={s.qualityValue}>
                                                    {metricNumber((currentPage.parsed as any).imageQuality.detectedCellCount, 0)}
                                                </Text>
                                            </View>
                                        </View>
                                        {!!(currentPage.parsed as any).imageQuality.gridSource && (
                                            <Text style={s.qualitySource}>
                                                Izvor mreže: {gridSourceLabel((currentPage.parsed as any).imageQuality.gridSource)}
                                            </Text>
                                        )}
                                        {(lowConfidence((currentPage.parsed as any).imageQuality.paperDetectionConfidence) ||
                                            lowConfidence((currentPage.parsed as any).imageQuality.gridDetectionConfidence)) && (
                                            <Text style={s.warning}>
                                                Poravnanje papira nije sigurno. Možeš ručno ispraviti podatke ili ponovno skenirati unutar okvira.
                                            </Text>
                                        )}
                                    </View>
                                )}
                            </View>

                            <View style={s.card}>
                                <Text style={s.title}>Podaci</Text>
                                {((currentPage.parsed as any)?.warnings ?? []).map((warning: string, i: number) => (
                                    <Text key={`${warning}-${i}`} style={s.warning}>{warning}</Text>
                                ))}

                                <View style={s.partnerContext}>
                                    <View style={s.partnerContextHeader}>
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <Text style={s.partnerContextLabel}>Partner</Text>
                                            <Text style={s.partnerContextName} numberOfLines={2}>{currentPartnerLabel}</Text>
                                        </View>
                                        {!lockedPartnerContext && (
                                            <Pressable
                                                style={s.partnerSelectButton}
                                                onPress={() => setPartnerPickerOpen(true)}
                                                disabled={busy}
                                            >
                                                <Text style={s.partnerSelectText}>{currentPage.partnerId ? "Promijeni" : "Odaberi"}</Text>
                                            </Pressable>
                                        )}
                                    </View>
                                    {!currentPage.partnerId && (
                                        <Text style={s.partnerContextHint}>Partner nije pouzdano prepoznat. Odaberi ga ručno.</Text>
                                    )}
                                    {hasConfidence(currentPage.partnerConfidence) && (
                                        <View style={[s.confidenceBadge, assuranceStyle(confidenceLevelFromValues(currentPage.partnerConfidence))]}>
                                            <Text style={s.confidenceBadgeText}>{confidenceText(currentPage.partnerConfidence)}</Text>
                                        </View>
                                    )}
                                </View>

                                <View style={s.dateBlock}>
                                    <Pressable
                                        style={[s.dateField, datePickerOpen && s.dateFieldActive]}
                                        onPress={() => {
                                            Keyboard.dismiss();
                                            setDatePickerOpen(true);
                                        }}
                                        disabled={busy}
                                    >
                                        <View>
                                            <Text style={s.dateLabel}>Datum sa papira</Text>
                                            <Text style={[s.dateValue, !currentPage.documentDate && s.dateValueEmpty]}>
                                                {fmtHrFromIso(currentPage.documentDate) || "Odaberi datum"}
                                            </Text>
                                        </View>
                                        <FontAwesome name="calendar" size={18} color={Colors.text} />
                                    </Pressable>

                                    {hasConfidence(currentPage.documentDateConfidence) && (
                                        <View style={[s.confidenceBadge, assuranceStyle(confidenceLevelFromValues(currentPage.documentDateConfidence))]}>
                                            <Text style={s.confidenceBadgeText}>{confidenceText(currentPage.documentDateConfidence)}</Text>
                                        </View>
                                    )}

                                    {datePickerOpen && (
                                        Platform.OS === "ios" ? (
                                            <View style={s.inlineDatePicker}>
                                                <DateTimePicker
                                                    value={currentDateValue}
                                                    mode="date"
                                                    display="inline"
                                                    onChange={onDocumentDateChange}
                                                    themeVariant="light"
                                                />
                                                <Pressable style={s.dateDoneButton} onPress={() => setDatePickerOpen(false)}>
                                                    <Text style={s.dateDoneText}>Gotovo</Text>
                                                </Pressable>
                                            </View>
                                        ) : (
                                            <DateTimePicker
                                                value={currentDateValue}
                                                mode="date"
                                                display="default"
                                                onChange={onDocumentDateChange}
                                            />
                                        )
                                    )}
                                </View>

                                <TextInput
                                    style={[s.field, { minHeight: 76, paddingTop: 12 }]}
                                    value={currentPage.note}
                                    onChangeText={(value) => invalidatePage(currentPage.id, { note: value })}
                                    multiline
                                    placeholder="Napomena"
                                    placeholderTextColor={Colors.sub}
                                />
                            </View>

                            <View style={s.card}>
                                <View style={s.sectionHeader}>
                                    <View>
                                        <Text style={s.title}>Stavke</Text>
                                        <Text style={s.sub}>Količine, dodatni tekst i ručne stavke</Text>
                                    </View>
                                    <Pressable style={s.addLineButton} onPress={addManualLine} disabled={busy}>
                                        <FontAwesome name="plus" size={12} color={Colors.text} />
                                        <Text style={s.addLineText}>Dodaj</Text>
                                    </Pressable>
                                </View>

                                {currentPage.lines.map((line, index) => {
                                    const hasPositiveQuantity = quantityValue(line) > 0;
                                    const linkedItem = !!cleanNumber(line.itemId);
                                    const needsManual = hasPositiveQuantity && !linkedItem;
                                    const needsQuantity = linkedItem && !hasPositiveQuantity;
                                    const scanConfidenceLevel = confidenceLevelFromValues(line.confidence, line.confidenceLevel);
                                    const readyLine = linkedItem && hasPositiveQuantity;
                                    const level: AssuranceLevel = needsManual ? "low" : readyLine ? scanConfidenceLevel : "medium";

                                    return (
                                        <View
                                            key={`${line.slipItemCode ?? "line"}-${index}`}
                                            style={[
                                                s.row,
                                                linkedItem && hasPositiveQuantity && s.rowLinked,
                                                needsQuantity && s.rowNeedsQuantity,
                                                (needsManual || scanConfidenceLevel === "low") && s.rowLow,
                                            ]}
                                        >
                                            <View style={s.rowTop}>
                                                <Text style={s.rowTitle}>
                                                    {line.slipItemCode || "----"} • {lineDisplayName(line)}
                                                </Text>
                                                <View style={[s.assurancePill, assuranceStyle(level)]}>
                                                    <Text style={s.assurancePillText}>
                                                        {needsManual
                                                            ? "ručno"
                                                            : readyLine
                                                                ? scanConfidenceLevel === "high"
                                                                    ? "spremno"
                                                                    : "provjeri"
                                                                : linkedItem
                                                                    ? "količina"
                                                                    : "prazno"}
                                                    </Text>
                                                </View>
                                            </View>

                                            <Text style={s.sourceText}>{sourceLabel(line.source)}</Text>

                                            {hasPositiveQuantity && hasConfidence(line.confidence, line.confidenceLevel) && (
                                                <View style={[s.confidenceBadge, assuranceStyle(scanConfidenceLevel)]}>
                                                    <Text style={s.confidenceBadgeText}>
                                                        {confidenceText(line.confidence, line.confidenceLevel)}
                                                    </Text>
                                                </View>
                                            )}

                                            {!!lineSubtitle(line) && <Text style={s.sub}>{lineSubtitle(line)}</Text>}
                                            {!!line.warning && <Text style={s.warning}>{line.warning}</Text>}

                                            <TextInput
                                                style={s.qtyInput}
                                                value={line.quantity}
                                                onChangeText={(value) => updateLine(index, {
                                                    quantity: value,
                                                    confidence: 1,
                                                    confidenceLevel: "HIGH",
                                                    valid: null,
                                                })}
                                                keyboardType="decimal-pad"
                                                placeholder="Količina"
                                                placeholderTextColor={Colors.sub}
                                            />

                                            <View style={s.itemActionRow}>
                                                <Pressable
                                                    style={[s.linkButton, linkedItem && s.linkButtonLinked, { flex: 1 }]}
                                                    onPress={() => setItemPickerIndex(index)}
                                                    disabled={busy || !warehouseId}
                                                >
                                                    <Text style={[s.linkButtonText, linkedItem && s.linkButtonTextLinked]}>
                                                        {line.itemId ? "Promijeni artikl" : "Poveži artikl"}
                                                    </Text>
                                                </Pressable>
                                                <Pressable
                                                    style={s.deleteLineButton}
                                                    onPress={() => removeLine(index)}
                                                    disabled={busy}
                                                >
                                                    <FontAwesome name="trash" size={14} color="#b91c1c" />
                                                </Pressable>
                                            </View>

                                            {needsManual ? (
                                                <Text style={s.warning}>Artikl nije pronađen za ovu šifru. Odaberi artikl pa ponovno validiraj.</Text>
                                            ) : null}
                                            {needsQuantity ? (
                                                <Text style={s.warning}>Artikl je povezan. Upiši količinu pa ponovno validiraj.</Text>
                                            ) : null}
                                            {readyLine && scanConfidenceLevel !== "high" ? (
                                                <Text style={s.warning}>Provjeri količinu jer prepoznavanje nije potpuno sigurno.</Text>
                                            ) : null}
                                        </View>
                                    );
                                })}
                            </View>
                        </>
                    )}

                    <View style={s.card}>
                        {!!currentValidationError && <Text style={s.warning}>{currentValidationError}</Text>}
                        {!!saveAllError && saveAllError !== currentValidationError && (
                            <Text style={s.warning}>{saveAllError}</Text>
                        )}
                        <PrimaryButton
                            label={saveM.isPending ? "Spremam..." : pages.length > 1 ? "Dodaj sve u evidenciju" : "Dodaj u unos"}
                            onPress={saveAll}
                            loading={saveM.isPending}
                            disabled={!!saveAllError || busy}
                        />
                    </View>
                </ScrollView>
            </View>
        </Screen>
    );
}
