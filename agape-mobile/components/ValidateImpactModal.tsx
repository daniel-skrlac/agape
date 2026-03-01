import React, { useMemo } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Colors from "@/src/constants/Colors";

import type { BookingImpactItemDTO, WarehouseBookingImpactDTO } from "@/src/models/generated";
import { styles as s } from "./styles/ValidateImpactModal.styles";
import { ErrorCard } from "./ErrorCard";
import { toFiniteNumber, formatQtyHRNullable } from "@/src/utils/format";

type Props = {
  visible: boolean;
  onClose: () => void;
  disableClose?: boolean;

  loading: boolean;
  error?: string | null;

  data: WarehouseBookingImpactDTO | null;

  onConfirm: () => void;
  confirmText?: string;

  showConfirm?: boolean;
  bulkHint?: string | null;
};

type Status = "ok" | "warn";

function badgeTone(kind: Status) {
  if (kind === "warn") return { bg: Colors.status.warnBg, bd: Colors.status.warnBd, tx: Colors.text };
  return { bg: Colors.status.okBg, bd: Colors.status.okBd, tx: Colors.text };
}

function statusOfItem(it: any): Status {
  const after = toFiniteNumber(it?.afterEffectiveQty);
  if (after != null && after < 0) return "warn";
  return "ok";
}

function statusLabel(st: Status) {
  if (st === "warn") return "IDE U MINUS";
  return "OK";
}

function modeTitle(data: any) {
  return data?.draft ? "Draft (neproknjiženo)" : "Final (proknjiženo)";
}

type FieldKey = "currentQty" | "pendingOutQty" | "pendingInQty" | "inQty" | "outQty";

const FIELD_META: Record<FieldKey, { title: string; beforeKey: string; afterKey: string }> = {
  currentQty: { title: "Trenutna zaliha", beforeKey: "beforeCurrentQty", afterKey: "afterCurrentQty" },
  pendingOutQty: { title: "Neproknjiženo (OUT)", beforeKey: "beforePendingOutQty", afterKey: "afterPendingOutQty" },
  pendingInQty: { title: "Neproknjiženo (IN)", beforeKey: "beforePendingInQty", afterKey: "afterPendingInQty" },
  inQty: { title: "Promet (IN)", beforeKey: "beforeInQty", afterKey: "afterInQty" },
  outQty: { title: "Promet (OUT)", beforeKey: "beforeOutQty", afterKey: "afterOutQty" },
};

function renderBeforeAfterRow(key: string, label: string, beforeVal: any, afterVal: any, emphasize?: boolean) {
  return (
    <View key={key} style={s.rowCard}>
      <Text style={s.rowTitle}>{label}</Text>

      <View style={s.rowGrid}>
        <View style={s.rowCell}>
          <Text style={s.rowLabel}>Prije</Text>
          <Text style={s.rowValue}>{formatQtyHRNullable(beforeVal)}</Text>
        </View>

        <View style={s.rowArrow}>
          <FontAwesome name="arrow-right" size={14} color={Colors.sub} />
        </View>

        <View style={s.rowCell}>
          <Text style={[s.rowValue, emphasize && { color: Colors.text }]}>{formatQtyHRNullable(afterVal)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function ValidateImpactModal(props: Props) {
  const { visible, onClose, disableClose, loading, error, data, onConfirm, confirmText, showConfirm = true, bulkHint } =
    props;

  const onlyChanges = true;

  const items: BookingImpactItemDTO[] = (((data as any)?.items ?? []) as BookingImpactItemDTO[]) ?? [];

  const counts = useMemo(() => {
    let ok = 0,
      warn = 0;

    for (const it of items as any[]) {
      const st = statusOfItem(it);
      if (st === "ok") ok++;
      else warn++;
    }
    return { ok, warn, total: items.length };
  }, [items]);

  const canConfirm = showConfirm && !disableClose && !loading && !error && !!data;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={disableClose ? undefined : onClose}
    >
      <View style={s.wrap}>
        <View style={s.backdrop} />

        <View style={s.card}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Provjera utjecaja na skladište</Text>
              {!!data ? (
                <Text style={s.subtitle}>
                  {modeTitle(data as any)} • DOK: {String((data as any).documentCode ?? "")}
                </Text>
              ) : (
                <Text style={s.subtitle}>Prije kreiranja provjeravamo očekivane promjene.</Text>
              )}
            </View>

            <Pressable
              style={[s.iconBtn, disableClose && { opacity: 0.5 }]}
              onPress={disableClose ? undefined : onClose}
              disabled={!!disableClose}
              hitSlop={10}
            >
              <FontAwesome name="close" size={18} color={Colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            {loading ? (
              <View style={s.stateBox}>
                <ActivityIndicator />
                <Text style={s.stateTitle}>Provjeravam…</Text>
                <Text style={s.stateSub}>Analiziram stavke i očekivane promjene.</Text>
              </View>
            ) : error ? (
              <ErrorCard
                title="Validacija nije uspjela"
                message={error}
                actionText="Zatvori"
                onAction={onClose}
                disabled={!!disableClose}
                titleLines={1}
                messageLines={3}
              />
            ) : !data ? (
              <View style={s.stateBox}>
                <Text style={s.stateTitle}>Nema podataka</Text>
                <Text style={s.stateSub}>Pokreni validaciju kako bi vidio rezultat.</Text>
              </View>
            ) : (
              <>
                {/* Summary */}
                <View style={s.summaryCard}>
                  {!!bulkHint ? (
                    <View style={s.bulkHint}>
                      <FontAwesome name="info-circle" size={16} color={Colors.sub} />
                      <Text style={s.bulkHintText}>{bulkHint}</Text>
                    </View>
                  ) : null}

                  <View style={s.summaryRow}>
                    <View style={s.summaryCell}>
                      <Text style={s.summaryLabel}>Skladište</Text>
                      <Text style={s.summaryValue}>{String((data as any).warehouseId ?? "")}</Text>
                    </View>

                    <View style={s.summaryCell}>
                      <Text style={s.summaryLabel}>Stavki</Text>
                      <Text style={s.summaryValue}>{String(counts.total)}</Text>
                    </View>
                  </View>

                  <View style={s.kpiRow}>
                    <View style={[s.kpiPill, { backgroundColor: Colors.status.okBg, borderColor: Colors.status.okBd }]}>
                      <Text style={s.kpiText}>OK: {counts.ok}</Text>
                    </View>
                    <View style={[s.kpiPill, { backgroundColor: Colors.status.warnBg, borderColor: Colors.status.warnBd }]}>
                      <Text style={s.kpiText}>U minus: {counts.warn}</Text>
                    </View>
                  </View>

                  {counts.warn > 0 ? (
                    <View style={s.noticeWarn}>
                      <FontAwesome name="warning" size={16} color={Colors.text} />
                      <Text style={s.noticeWarnText}>Neke stavke idu u minus nakon promjene. Možeš nastaviti.</Text>
                    </View>
                  ) : (
                    <View style={s.noticeOk}>
                      <FontAwesome name="check" size={16} color={Colors.text} />
                      <Text style={s.noticeOkText}>Sve izgleda u redu. Možeš kreirati dokument.</Text>
                    </View>
                  )}
                </View>

                {/* Items */}
                <View style={s.listHeader}>
                  <Text style={s.listTitle}>Stavke</Text>
                  <Text style={s.listSub}>Prikazujemo prije/poslije i samo polja koja su se stvarno promijenila.</Text>
                </View>

                <View style={{ gap: 10 }}>
                  {items.map((it: any, idx: number) => {
                    const stt = statusOfItem(it);
                    const tone = badgeTone(stt);

                    const itemId = it?.itemId ?? "x";
                    const itemKey = `${itemId}-${idx}`;

                    const name = String(it?.name ?? "").trim();
                    const code = String(it?.itemCode ?? "").trim();
                    const unit = String(it?.unit ?? "").trim();
                    const metaLine = [code ? `Šifra: ${code}` : null, unit ? `JMJ: ${unit}` : null]
                      .filter(Boolean)
                      .join(" • ");

                    const changedFields: string[] = (it?.changedFields ?? []) as string[];

                    const fieldCards: React.ReactNode[] = [];
                    fieldCards.push(
                      renderBeforeAfterRow(
                        `${itemKey}-effective`,
                        "Efektivno (dostupno)",
                        it?.beforeEffectiveQty,
                        it?.afterEffectiveQty,
                        stt !== "ok"
                      )
                    );

                    (Object.keys(FIELD_META) as FieldKey[]).forEach((k) => {
                      const meta = FIELD_META[k];
                      const beforeVal = (it as any)?.[meta.beforeKey];
                      const afterVal = (it as any)?.[meta.afterKey];

                      const isChanged = changedFields.includes(k);
                      const hasAnyValue = beforeVal != null || afterVal != null;

                      const shouldShow = onlyChanges ? isChanged : hasAnyValue || isChanged;
                      if (!shouldShow) return;

                      fieldCards.push(renderBeforeAfterRow(`${itemKey}-${k}`, meta.title, beforeVal, afterVal));
                    });

                    return (
                      <View key={itemKey} style={s.itemCard}>
                        <View style={s.itemTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.itemName} numberOfLines={2}>
                              {name}
                            </Text>
                            {!!metaLine && (
                              <Text style={s.itemMeta} numberOfLines={1}>
                                {metaLine}
                              </Text>
                            )}
                          </View>

                          <View style={[s.badge, { backgroundColor: tone.bg, borderColor: tone.bd }]}>
                            <Text style={[s.badgeText, { color: tone.tx }]}>{statusLabel(stt)}</Text>
                          </View>
                        </View>

                        <View style={{ gap: 10 }}>{fieldCards}</View>
                      </View>
                    );
                  })}
                </View>

                {/* Actions */}
                <View style={{ gap: 10, marginTop: 6 }}>
                  {showConfirm ? (
                    <Pressable style={[s.primary, !canConfirm && { opacity: 0.5 }]} onPress={onConfirm} disabled={!canConfirm}>
                      <Text style={s.primaryText}>{confirmText ?? "Kreiraj"}</Text>
                    </Pressable>
                  ) : null}

                  <Pressable style={[s.secondary, disableClose && { opacity: 0.5 }]} onPress={disableClose ? undefined : onClose} disabled={!!disableClose}>
                    <Text style={s.secondaryText}>{showConfirm ? "Zatvori" : "Natrag"}</Text>
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