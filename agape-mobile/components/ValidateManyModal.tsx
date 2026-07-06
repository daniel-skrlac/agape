import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import Colors from "@/src/constants/Colors";
import type { WarehouseBookingImpactDTO } from "@/src/models/generated";

export type ValidateRow = {
  partnerId: number;
  partnerName: string;
  ok: number;
  warn: number;
  bad: number;
  total: number;
  data: WarehouseBookingImpactDTO | null;
  error: string | null;
  warning: string | null;
  contextLabel?: string | null;
  contextSub?: string | null;
};

export function classifyValidationImpact(data: any) {
  const items: any[] = ((data as any)?.items ?? []) as any[];
  let ok = 0;
  let warn = 0;
  let bad = 0;

  for (const it of items) {
    if (!!it?.missingInWarehouse) {
      bad++;
      continue;
    }
    const after = Number(String(it?.afterEffectiveQty ?? "").replace(",", "."));
    if (Number.isFinite(after) && after < 0) warn++;
    else ok++;
  }

  return { ok, warn, bad, total: items.length };
}

export function toValidateRow(args: {
  partnerId: number;
  partnerName: string;
  data: WarehouseBookingImpactDTO | null;
  error: string | null;
  warning?: string | null;
  contextLabel?: string | null;
  contextSub?: string | null;
}): ValidateRow {
  const { partnerId, partnerName, data, error, warning = null, contextLabel = null, contextSub = null } = args;
  const stats = data ? classifyValidationImpact(data) : { ok: 0, warn: 0, bad: 0, total: 0 };

  return { partnerId, partnerName, ...stats, data, error, warning, contextLabel, contextSub };
}

function badgeStyle(kind: "OK" | "WARN") {
  if (kind === "OK") {
    return {
      backgroundColor: "rgba(34,197,94,0.14)",
      borderColor: "rgba(34,197,94,0.30)",
      textColor: Colors.text,
    };
  }

  return {
    backgroundColor: "rgba(249,115,22,0.14)",
    borderColor: "rgba(249,115,22,0.30)",
    textColor: Colors.text,
  };
}

type Props = {
  visible: boolean;
  loading: boolean;
  rows: ValidateRow[];
  onClose: () => void;
  onConfirm: () => void;
  onOpenDetail: (row: ValidateRow) => void;
  disableClose?: boolean;
  title?: string;
  subtitle?: string;
  confirmText?: string;
  disabledConfirmText?: string;
  loadingTitle?: string;
  loadingSubtitle?: string;
};

export default function ValidateManyModal(props: Props) {
  const {
    visible,
    loading,
    rows,
    onClose,
    onConfirm,
    onOpenDetail,
    disableClose,
    title = "Validacija prije knjiženja",
    subtitle = "Provjera po partneru prije finalnog knjiženja.",
    confirmText = "Knjiži sesiju",
    disabledConfirmText = "Ne mogu knjižiti",
    loadingTitle = "Provjeravam…",
    loadingSubtitle = "Molim pričekaj.",
  } = props;

  const summary = useMemo(() => {
    const okPartners = rows.filter((r) => !r.error && r.bad === 0 && r.warn === 0).length;
    const minusPartners = rows.filter((r) => !!r.error || r.bad > 0 || r.warn > 0).length;
    const anyWarning = rows.some((r) => !!r.warning);
    const anyBlocking = rows.some((r) => !!r.error || r.bad > 0);
    return { okPartners, minusPartners, anyWarning, anyBlocking };
  }, [rows]);

  const canConfirm = !loading && !summary.anyBlocking;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={disableClose ? undefined : onClose}
    >
      <View style={s.wrap}>
        <Pressable style={s.backdrop} onPress={() => { }} />

        <View style={s.card}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{title}</Text>
              <Text style={s.sub}>{subtitle}</Text>
            </View>

            <Pressable
              style={[s.iconBtn, disableClose && { opacity: 0.5 }]}
              onPress={disableClose ? undefined : onClose}
              disabled={disableClose}
            >
              <FontAwesome name="close" size={18} color={Colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            {loading ? (
              <View style={s.stateBox}>
                <ActivityIndicator />
                <Text style={s.stateTitle}>{loadingTitle}</Text>
                <Text style={s.stateSub}>{loadingSubtitle}</Text>
              </View>
            ) : (
              <>
                <View style={s.summaryGrid}>
                  <View style={s.summaryChip}>
                    <Text style={s.summaryChipLabel}>OK</Text>
                    <Text style={s.summaryChipValue}>{summary.okPartners}</Text>
                  </View>
                  <View style={s.summaryChip}>
                    <Text style={s.summaryChipLabel}>MINUS</Text>
                    <Text style={s.summaryChipValue}>{summary.minusPartners}</Text>
                  </View>
                </View>

                {!!summary.anyWarning && (
                  <View style={s.warnBox}>
                    <View style={s.warnHeader}>
                      <FontAwesome name="warning" size={14} color={Colors.text} />
                      <Text style={s.warnTitle}>Napomena</Text>
                    </View>
                    <Text style={s.warnText}>Neki unosi koriste draft/store fallback za stavke.</Text>
                  </View>
                )}

                <View style={{ gap: 10 }}>
                  {rows.map((r, idx) => {
                    const isOk = !r.error && r.bad === 0 && r.warn === 0;
                    const tone = badgeStyle(isOk ? "OK" : "WARN");

                    return (
                      <Pressable
                        key={`r-${r.partnerId}-${idx}`}
                        style={s.rowCard}
                        onPress={() => onOpenDetail(r)}
                        android_disableSound
                      >
                        <View style={s.rowTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.rowName} numberOfLines={1}>
                              {r.partnerName}
                            </Text>
                            {!!r.contextLabel ? (
                              <Text style={s.rowContext} numberOfLines={1}>
                                {r.contextLabel}
                              </Text>
                            ) : null}
                            {!!r.contextSub ? (
                              <Text style={s.rowContextSub} numberOfLines={2}>
                                {r.contextSub}
                              </Text>
                            ) : null}
                            <Text style={s.rowSub}>
                              Stavki: {r.total}
                              {!!r.warning ? " • !" : ""}
                            </Text>
                          </View>

                          <View style={[s.pill, tone]}>
                            <Text style={[s.pillText, { color: tone.textColor }]}>
                              {isOk ? "OK" : `MINUS${r.warn > 0 ? ` ${r.warn}` : ""}`}
                            </Text>
                          </View>
                        </View>

                        <View style={s.rowBottom}>
                          <View style={s.rowMiniPills}>
                            <Text style={s.rowMiniText}>OK {r.ok}</Text>
                            <Text style={s.rowMiniText}>MINUS {r.warn + r.bad + (r.error ? 1 : 0)}</Text>
                          </View>

                          <View style={s.smallHintPill}>
                            <FontAwesome name="search" size={11} color={Colors.sub} />
                            <Text style={s.smallHintText}>Detalji</Text>
                          </View>
                        </View>

                        {!!r.error ? (
                          <Text style={s.warningLine} numberOfLines={2}>
                            {r.error}
                          </Text>
                        ) : r.bad > 0 ? (
                          <Text style={s.warningLine} numberOfLines={2}>
                            Nedostaju stavke u skladištu ({r.bad}).
                          </Text>
                        ) : null}

                        {!!r.warning ? (
                          <Text style={s.warningLine} numberOfLines={2}>
                            {r.warning}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={{ gap: 10, marginTop: 6 }}>
                  <Pressable
                    style={[s.primary, !canConfirm && { opacity: 0.5 }]}
                    onPress={onConfirm}
                    disabled={!canConfirm}
                  >
                    <Text style={s.primaryText}>
                      {canConfirm ? confirmText : disabledConfirmText}
                    </Text>
                  </Pressable>

                  <Pressable style={s.secondary} onPress={onClose} disabled={disableClose}>
                    <Text style={s.secondaryText}>Zatvori</Text>
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },

  card: {
    width: "100%",
    maxWidth: 560,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    overflow: "hidden",
    maxHeight: "88%",
  },

  header: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: { fontWeight: "900", color: Colors.text, fontSize: 16, lineHeight: 20 },
  sub: { marginTop: 2, color: Colors.sub, fontWeight: "800", fontSize: 12, lineHeight: 16 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  body: { padding: 14, gap: 12, paddingBottom: 18 },

  stateBox: { paddingVertical: 18, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", gap: 8 },
  stateTitle: { fontWeight: "900", color: Colors.text, fontSize: 14 },
  stateSub: { fontWeight: "800", color: Colors.sub, fontSize: 12, textAlign: "center" },

  summaryGrid: { flexDirection: "row", gap: 8 },
  summaryChip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "rgba(148,163,184,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.08)",
  },
  summaryChipLabel: { fontWeight: "800", color: Colors.sub, fontSize: 10 },
  summaryChipValue: { fontWeight: "900", color: Colors.text, fontSize: 14 },

  warnBox: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(249,115,22,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.28)",
    gap: 8,
  },
  warnHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  warnTitle: { fontWeight: "900", color: Colors.text, fontSize: 13 },
  warnText: { fontWeight: "800", color: Colors.text, opacity: 0.95, fontSize: 12 },

  rowCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    padding: 12,
    gap: 8,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rowName: { fontWeight: "900", color: Colors.text, fontSize: 15 },
  rowContext: { fontWeight: "900", color: Colors.text, fontSize: 12, marginTop: 4 },
  rowContextSub: { fontWeight: "800", color: Colors.sub, fontSize: 11, marginTop: 2, lineHeight: 15 },
  rowSub: { fontWeight: "800", color: Colors.sub, fontSize: 12, marginTop: 2 },

  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowMiniPills: { flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1 },
  rowMiniText: { fontWeight: "800", color: Colors.sub, fontSize: 11 },

  warningLine: { fontWeight: "800", color: Colors.sub, fontSize: 12 },

  smallHintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.08)",
  },
  smallHintText: { fontWeight: "900", color: Colors.sub, fontSize: 11 },

  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  pillText: { fontWeight: "900", fontSize: 11 },

  primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },

  secondary: { padding: 12, borderRadius: 14, backgroundColor: "rgba(148,163,184,0.18)", alignItems: "center" },
  secondaryText: { fontWeight: "900", color: Colors.text },
});
