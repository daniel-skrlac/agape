import React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Colors from "@/constants/Colors";

type Props = {
  visible: boolean;
  onClose: () => void;
  disableClose?: boolean;

  loading: boolean;
  error?: string | null;

  // backend returns WarehouseBookingImpactDTO
  data: any | null;

  onConfirm: () => void;
  confirmText?: string;
};

function fmt(n: any) {
  if (n == null) return "";
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return String(n);
  // keep it simple; you can localize later
  return String(x);
}

export default function ValidateImpactModal(props: Props) {
  const { visible, onClose, disableClose, loading, error, data, onConfirm, confirmText } = props;

  const items: any[] = (data?.items ?? []) as any[];

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={disableClose ? undefined : onClose}>
      <View style={s.wrap}>
        <Pressable style={s.backdrop} onPress={disableClose ? undefined : onClose} />

        <View style={s.card}>
          <View style={s.header}>
            <Text style={s.title}>Validacija utjecaja</Text>
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
              <View style={s.loadingBox}>
                <ActivityIndicator />
                {/* NO "Not found" text while loading */}
              </View>
            ) : error ? (
              <View style={s.errBox}>
                <Text style={s.errText}>{error}</Text>
              </View>
            ) : !data ? (
              <View style={s.loadingBox}>
                <Text style={{ fontWeight: "900", color: Colors.sub }}>Nema podataka.</Text>
              </View>
            ) : (
              <>
                <View style={s.summary}>
                  <Text style={s.summaryText}>Skladište: {String(data?.warehouseId ?? "")}</Text>
                  <Text style={s.summaryText}>Stavki: {items.length}</Text>
                </View>

                <View style={{ gap: 10 }}>
                  {items.map((it) => {
                    const missing = !!it?.missingInWarehouse;
                    const afterEff = it?.afterEffectiveQty;
                    const afterEffNum = Number(afterEff);
                    const warn = Number.isFinite(afterEffNum) && afterEffNum < 0;

                    return (
                      <View key={String(it?.itemId)} style={[s.row, missing && s.rowMissing, warn && s.rowWarn]}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={s.itemName} numberOfLines={2}>
                            {it?.name}
                          </Text>
                          <Text style={s.itemMeta} numberOfLines={1}>
                            {[
                              it?.itemCode ? `Šifra: ${it.itemCode}` : null,
                              it?.unit ? `JMJ: ${it.unit}` : null,
                              missing ? "Nema u skladištu" : null,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </Text>

                          <Text style={s.itemMeta} numberOfLines={1}>
                            {[
                              it?.effectiveQty != null ? `Effective: ${fmt(it.effectiveQty)}` : null,
                              it?.deltaPendingOutQty != null ? `Δ Out: ${fmt(it.deltaPendingOutQty)}` : null,
                              it?.deltaPendingInQty != null ? `Δ In: ${fmt(it.deltaPendingInQty)}` : null,
                              it?.afterEffectiveQty != null ? `After: ${fmt(it.afterEffectiveQty)}` : null,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                <Pressable style={s.primary} onPress={onConfirm} disabled={disableClose}>
                  <Text style={s.primaryText}>{confirmText ?? "Kreiraj"}</Text>
                </Pressable>

                <Pressable style={s.secondary} onPress={onClose} disabled={disableClose}>
                  <Text style={s.secondaryText}>Zatvori</Text>
                </Pressable>
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
    maxHeight: "85%",
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
  title: { fontWeight: "900", color: Colors.text, fontSize: 16, flex: 1 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 14, gap: 12, paddingBottom: 20 },

  loadingBox: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  errBox: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.dangerBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.dangerText,
  },
  errText: { fontWeight: "900", color: Colors.dangerText },

  summary: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  summaryText: { fontWeight: "900", color: Colors.text },

  row: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowMissing: { backgroundColor: "rgba(239,68,68,0.08)" },
  rowWarn: { backgroundColor: "rgba(249,115,22,0.10)" },

  itemName: { fontWeight: "900", color: Colors.text, fontSize: 15 },
  itemMeta: { color: Colors.sub, fontWeight: "800" },

  primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },

  secondary: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
  },
  secondaryText: { fontWeight: "900", color: Colors.text },
});
