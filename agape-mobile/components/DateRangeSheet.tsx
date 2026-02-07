// components/DateRangeSheet.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import Colors from "@/constants/Colors";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayLocalNoon() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

function dateToIsoLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isoToDateLocal(iso?: string | null): Date | null {
  if (!iso) return null;
  const s = String(iso).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map((x) => Number(x));
  const dt = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function fmtHrFromIso(iso?: string | null): string {
  if (!iso) return "";
  const s = String(iso).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

function isoAddDays(days: number) {
  const d = todayLocalNoon();
  d.setDate(d.getDate() + days);
  return dateToIsoLocal(d);
}

function monthStartIso() {
  const d = todayLocalNoon();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
}

type Props = {
  visible: boolean;
  onClose: () => void;

  // ISO (YYYY-MM-DD) OR null/empty => no filter
  valueFromIso?: string | null;
  valueToIso?: string | null;

  // pass null/null to clear
  onApplyIso: (fromIso: string | null, toIso: string | null) => void;
};

const C = {
  text: "#0F172A",
  sub: "rgba(15,23,42,0.66)",
  border: "rgba(15,23,42,0.16)",
  bg: "#FFFFFF",
  panel: "rgba(15,23,42,0.06)",
  panel2: "rgba(15,23,42,0.03)",

  orange: "#F97316",
  orangeBg: "rgba(249,115,22,0.16)",
  orangeBd: "rgba(249,115,22,0.55)",
  orangeTx: "#F97316",

  softShadow: "rgba(15,23,42,0.10)",
};

type QuickKey = "TODAY" | "LAST7" | "MONTH" | "NONE";

export function DateRangeSheet(props: Props) {
  const { visible, onClose, valueFromIso = null, valueToIso = null, onApplyIso } = props;
  const { width, height } = useWindowDimensions();

  const [fromDate, setFromDate] = useState<Date | null>(isoToDateLocal(valueFromIso));
  const [toDate, setToDate] = useState<Date | null>(isoToDateLocal(valueToIso));
  const [active, setActive] = useState<"from" | "to">("from");

  // Android popups
  const [showAndroidFrom, setShowAndroidFrom] = useState(false);
  const [showAndroidTo, setShowAndroidTo] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setFromDate(isoToDateLocal(valueFromIso));
    setToDate(isoToDateLocal(valueToIso));
    setActive("from");
    setShowAndroidFrom(false);
    setShowAndroidTo(false);
  }, [visible, valueFromIso, valueToIso]);

  const fromIso = useMemo(() => (fromDate ? dateToIsoLocal(fromDate) : null), [fromDate]);
  const toIso = useMemo(() => (toDate ? dateToIsoLocal(toDate) : null), [toDate]);
  const isNone = !fromIso && !toIso;

  const title = useMemo(() => {
    if (isNone) return "Bez datuma (sve)";
    return `${fmtHrFromIso(fromIso) || "…"} → ${fmtHrFromIso(toIso) || "…"}`;
  }, [fromIso, toIso, isNone]);

  const ensureFrom = () => setFromDate((v) => v ?? todayLocalNoon());
  const ensureTo = () => setToDate((v) => v ?? todayLocalNoon());

  const openPicker = (which: "from" | "to") => {
    setActive(which);
    if (which === "from") {
      ensureFrom();
      if (Platform.OS === "android") setShowAndroidFrom(true);
    } else {
      ensureTo();
      if (Platform.OS === "android") setShowAndroidTo(true);
    }
  };

  const setQuick = (from: string, to: string) => {
    setFromDate(isoToDateLocal(from));
    setToDate(isoToDateLocal(to));
  };

  const clearLocal = () => {
    setFromDate(null);
    setToDate(null);
  };

  const apply = () => {
    // no filter
    if (!fromDate && !toDate) {
      onApplyIso(null, null);
      onClose();
      return;
    }

    // if only one picked => single-day range
    const a = fromDate ?? toDate ?? todayLocalNoon();
    const b = toDate ?? fromDate ?? todayLocalNoon();

    const aIso = dateToIsoLocal(a);
    const bIso = dateToIsoLocal(b);

    onApplyIso(aIso <= bIso ? aIso : bIso, aIso <= bIso ? bIso : aIso);
    onClose();
  };

  const clearAndClose = () => {
    onApplyIso(null, null);
    onClose();
  };

  const onChangeFrom = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === "android") setShowAndroidFrom(false);
    if (e.type === "dismissed") return;
    if (!d) return;
    setFromDate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0));
  };

  const onChangeTo = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === "android") setShowAndroidTo(false);
    if (e.type === "dismissed") return;
    if (!d) return;
    setToDate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0));
  };

  // ✅ symmetric outer padding + symmetric computed width
  const PAD = 16;
  const cardW = Math.min(560, Math.floor(width - PAD * 2));
  const cardH = Math.min(720, Math.max(420, Math.floor(height * 0.80)));

  const pickerValue = useMemo(() => {
    return active === "from" ? fromDate ?? todayLocalNoon() : toDate ?? todayLocalNoon();
  }, [active, fromDate, toDate]);

  // ✅ quick preset detection (also highlights when range matches manually chosen)
  const todayIso = useMemo(() => dateToIsoLocal(todayLocalNoon()), []);
  const last7FromIso = useMemo(() => isoAddDays(-7), []);
  const monthFromIso = useMemo(() => monthStartIso(), []);

  const quickKey = useMemo<QuickKey>(() => {
    if (isNone) return "NONE";
    if (fromIso === todayIso && toIso === todayIso) return "TODAY";
    if (fromIso === last7FromIso && toIso === todayIso) return "LAST7";
    if (fromIso === monthFromIso && toIso === todayIso) return "MONTH";
    return "NONE";
  }, [fromIso, toIso, isNone, todayIso, last7FromIso, monthFromIso]);

  const quickItems = useMemo(
    () =>
      [
        { key: "TODAY" as const, label: "Danas", icon: "sun-o" as const, meta: "" },
        { key: "LAST7" as const, label: "Zadnjih 7d", icon: "history" as const, meta: "7" },
        { key: "MONTH" as const, label: "Ovaj mjesec", icon: "calendar" as const, meta: "M" },
        { key: "NONE" as const, label: "Bez datuma", icon: "calendar-times-o" as const, meta: "" },
      ] as const,
    []
  );

  const quickPress = (k: QuickKey) => {
    if (k === "TODAY") setQuick(todayIso, todayIso);
    else if (k === "LAST7") setQuick(last7FromIso, todayIso);
    else if (k === "MONTH") setQuick(monthFromIso, todayIso);
    else clearLocal();
  };

  const isQuickActive = (k: QuickKey) => quickKey === k;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[s.backdrop, { padding: PAD }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[s.card, { width: cardW, height: cardH, alignSelf: "center" }]}>
          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.h1}>Period</Text>
              <Text style={s.h2} numberOfLines={1}>
                {title}
              </Text>
            </View>

            <Pressable style={s.iconBtn} onPress={onClose} hitSlop={10}>
              <FontAwesome name="close" size={18} color={C.text} />
            </Pressable>
          </View>

          {/* Body */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.body}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Inputs */}
            <View style={s.inputs}>
              <Pressable
                style={[s.datePill, active === "from" && s.datePillActive, !fromIso && s.datePillEmpty]}
                onPress={() => openPicker("from")}
              >
                <Text style={s.dateLbl}>Od</Text>
                <View style={s.dateValWrap}>
                  <FontAwesome name="calendar" size={14} color={C.text} />
                  <Text style={s.dateVal}>{fromIso ? fmtHrFromIso(fromIso) : "Odaberi"}</Text>
                </View>
              </Pressable>

              <Pressable
                style={[s.datePill, active === "to" && s.datePillActive, !toIso && s.datePillEmpty]}
                onPress={() => openPicker("to")}
              >
                <Text style={s.dateLbl}>Do</Text>
                <View style={s.dateValWrap}>
                  <FontAwesome name="calendar" size={14} color={C.text} />
                  <Text style={s.dateVal}>{toIso ? fmtHrFromIso(toIso) : "Odaberi"}</Text>
                </View>
              </Pressable>
            </View>

            {/* iOS inline picker */}
            {Platform.OS === "ios" && (
              <View style={s.pickerBox}>
                <View style={s.pickerTop}>
                  <Text style={s.pickerTitle}>{active === "from" ? "Od" : "Do"}</Text>

                  <View style={s.toggle}>
                    <Pressable style={[s.tBtn, active === "from" && s.tBtnActive]} onPress={() => setActive("from")}>
                      <Text style={[s.tText, active === "from" && s.tTextActive]}>Od</Text>
                    </Pressable>
                    <Pressable style={[s.tBtn, active === "to" && s.tBtnActive]} onPress={() => setActive("to")}>
                      <Text style={[s.tText, active === "to" && s.tTextActive]}>Do</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={{ height: 330 }}>
                  <DateTimePicker
                    value={pickerValue}
                    mode="date"
                    display="inline"
                    onChange={active === "from" ? onChangeFrom : onChangeTo}
                    themeVariant="light"
                    style={{ flex: 1, backgroundColor: C.bg }}
                  />
                </View>
              </View>
            )}

            {/* Android popups */}
            {Platform.OS === "android" && showAndroidFrom && (
              <DateTimePicker value={fromDate ?? todayLocalNoon()} mode="date" display="default" onChange={onChangeFrom} />
            )}
            {Platform.OS === "android" && showAndroidTo && (
              <DateTimePicker value={toDate ?? todayLocalNoon()} mode="date" display="default" onChange={onChangeTo} />
            )}

            {/* Quick presets (more representative) */}
            <View style={s.quickGrid}>
              {quickItems.map((it) => {
                const active = isQuickActive(it.key);
                return (
                  <Pressable
                    key={it.key}
                    style={[s.qTile, active && s.qTileActive]}
                    onPress={() => quickPress(it.key)}
                  >
                    <View style={[s.qIconWrap, active && s.qIconWrapActive]}>
                      <FontAwesome name={it.icon} size={16} color={active ? "#fff" : C.text} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[s.qTitle, active && s.qTitleActive]} numberOfLines={1}>
                        {it.label}
                      </Text>
                      <Text style={[s.qSub, active && s.qSubActive]} numberOfLines={1}>
                        {it.key === "TODAY"
                          ? "Danas"
                          : it.key === "LAST7"
                          ? "Raspon 7 dana"
                          : it.key === "MONTH"
                          ? "Od 1. u mjesecu"
                          : "Prikaži sve"}
                      </Text>
                    </View>

                    {!!it.meta && (
                      <View style={[s.qBadge, active && s.qBadgeActive]}>
                        <Text style={[s.qBadgeText, active && s.qBadgeTextActive]}>{it.meta}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={{ height: 8 }} />
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <Pressable style={s.secondary} onPress={clearAndClose}>
              <Text style={s.secondaryText}>Očisti</Text>
            </Pressable>

            <Pressable style={s.primary} onPress={apply}>
              <Text style={s.primaryText}>Primijeni</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    backgroundColor: C.bg,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  h1: { fontWeight: "900", color: C.text, fontSize: 18 },
  h2: { marginTop: 2, fontWeight: "800", color: C.sub, fontSize: 13 },

  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.panel,
  },

  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
  },

  inputs: { flexDirection: "row", gap: 12 },
  datePill: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    backgroundColor: C.panel,
    gap: 6,
  },
  datePillActive: {
    backgroundColor: C.orangeBg,
    borderColor: C.orangeBd,
  },
  datePillEmpty: { backgroundColor: C.panel2 },

  dateLbl: { fontWeight: "900", color: C.sub, fontSize: 12 },
  dateValWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  dateVal: { fontWeight: "900", color: C.text, fontSize: 15 },

  pickerBox: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    backgroundColor: C.bg,
    padding: 10,
    gap: 10,
  },
  pickerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pickerTitle: { fontWeight: "900", color: C.text, fontSize: 13 },

  toggle: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: C.panel,
  },
  tBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  tBtnActive: { backgroundColor: C.orangeBg },
  tText: { fontWeight: "900", color: C.sub, fontSize: 12 },
  tTextActive: { color: C.text },

  // ✅ nicer quick area (2 columns tiles)
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  qTile: {
    width: "48%",
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    backgroundColor: C.panel,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qTileActive: {
    backgroundColor: C.orange,
    borderColor: C.orange,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  qIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.panel2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  qIconWrapActive: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderColor: "rgba(255,255,255,0.35)",
  },

  qTitle: { fontWeight: "900", color: C.text, fontSize: 13 },
  qTitleActive: { color: "#fff" },

  qSub: { marginTop: 1, fontWeight: "800", color: C.sub, fontSize: 11 },
  qSubActive: { color: "rgba(255,255,255,0.90)" },

  qBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  qBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderColor: "rgba(255,255,255,0.35)",
  },
  qBadgeText: { fontWeight: "900", color: C.text, fontSize: 11 },
  qBadgeTextActive: { color: "#fff" },

  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    flexDirection: "row",
    gap: 12,
    backgroundColor: C.bg,
  },
  secondary: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontWeight: "900", color: C.text },

  primary: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontWeight: "900", color: "#fff" },
});
