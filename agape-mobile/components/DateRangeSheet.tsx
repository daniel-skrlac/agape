import React, { useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import Colors from "@/src/constants/Colors";

import {
  isoToDateLocal,
  dateToIsoLocal,
  fmtHrFromIso,
  todayLocalNoon,
  isoAddDaysFromToday,
  monthStartIsoFromToday,
} from "@/src/utils/dateIso";
import { DATE_RANGE_PAD, styles } from "./styles/DateRangeSheet.styles";

type Props = {
  visible: boolean;
  onClose: () => void;

  valueFromIso?: string | null;
  valueToIso?: string | null;

  onApplyIso: (fromIso: string | null, toIso: string | null) => void;
};

type QuickKey = "TODAY" | "LAST7" | "LAST30" | "MONTH" | "YEAR" | "NONE";
type ActiveQuickKey = QuickKey | "CUSTOM";

export function DateRangeSheet(props: Props) {
  const { visible, onClose, valueFromIso = null, valueToIso = null, onApplyIso } = props;
  const { width, height } = useWindowDimensions();

  const [fromDate, setFromDate] = useState<Date | null>(isoToDateLocal(valueFromIso));
  const [toDate, setToDate] = useState<Date | null>(isoToDateLocal(valueToIso));
  const [active, setActive] = useState<"from" | "to">("from");

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
    if (isNone) return "Svi datumi";
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
    if (!fromDate && !toDate) {
      onApplyIso(null, null);
      onClose();
      return;
    }

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

  const PAD = DATE_RANGE_PAD;
  const cardW = Math.min(560, Math.floor(width - PAD * 2));
  const cardH = Math.min(720, Math.max(420, Math.floor(height * 0.8)));

  const pickerValue = useMemo(() => {
    return active === "from" ? fromDate ?? todayLocalNoon() : toDate ?? todayLocalNoon();
  }, [active, fromDate, toDate]);

  const todayIso = useMemo(() => dateToIsoLocal(todayLocalNoon()), []);
  const last7FromIso = useMemo(() => isoAddDaysFromToday(-7), []);
  const last30FromIso = useMemo(() => isoAddDaysFromToday(-30), []);
  const monthFromIso = useMemo(() => monthStartIsoFromToday(), []);
  const yearFromIso = useMemo(() => {
    const d = todayLocalNoon();
    return `${d.getFullYear()}-01-01`;
  }, []);
  const yearToIso = useMemo(() => {
    const d = todayLocalNoon();
    return `${d.getFullYear()}-12-31`;
  }, []);

  const quickKey = useMemo<ActiveQuickKey>(() => {
    if (isNone) return "NONE";
    if (fromIso === todayIso && toIso === todayIso) return "TODAY";
    if (fromIso === last7FromIso && toIso === todayIso) return "LAST7";
    if (fromIso === last30FromIso && toIso === todayIso) return "LAST30";
    if (fromIso === monthFromIso && toIso === todayIso) return "MONTH";
    if (fromIso === yearFromIso && toIso === yearToIso) return "YEAR";
    return "CUSTOM";
  }, [fromIso, toIso, isNone, todayIso, last7FromIso, last30FromIso, monthFromIso, yearFromIso, yearToIso]);

  const quickItems = useMemo(
    () =>
      [
        { key: "TODAY" as const, label: "Danas", icon: "sun-o" as const, meta: "" },
        { key: "LAST7" as const, label: "Zadnjih 7d", icon: "history" as const, meta: "7" },
        { key: "LAST30" as const, label: "Zadnjih 30d", icon: "calendar-o" as const, meta: "30" },
        { key: "MONTH" as const, label: "Ovaj mjesec", icon: "calendar" as const, meta: "M" },
        { key: "YEAR" as const, label: "Ova godina", icon: "calendar-check-o" as const, meta: "G" },
        { key: "NONE" as const, label: "Svi datumi", icon: "calendar-times-o" as const, meta: "" },
      ] as const,
    []
  );

  const quickPress = (k: QuickKey) => {
    if (k === "TODAY") setQuick(todayIso, todayIso);
    else if (k === "LAST7") setQuick(last7FromIso, todayIso);
    else if (k === "LAST30") setQuick(last30FromIso, todayIso);
    else if (k === "MONTH") setQuick(monthFromIso, todayIso);
    else if (k === "YEAR") setQuick(yearFromIso, yearToIso);
    else clearLocal();
  };

  const isQuickActive = (k: QuickKey) => quickKey === k;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { padding: PAD }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.card, { width: cardW, height: cardH, alignSelf: "center" }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.flex1}>
              <Text style={styles.h1}>Period</Text>
              <Text style={styles.h2} numberOfLines={1}>
                {title}
              </Text>
            </View>

            <Pressable style={styles.iconBtn} onPress={onClose} hitSlop={10}>
              <FontAwesome name="close" size={18} color={Colors.text} />
            </Pressable>
          </View>

          {/* Body */}
          <ScrollView style={styles.flex1} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} bounces={false}>
            {/* Inputs */}
            <View style={styles.inputs}>
              <Pressable
                style={[styles.datePill, active === "from" && styles.datePillActive, !fromIso && styles.datePillEmpty]}
                onPress={() => openPicker("from")}
              >
                <Text style={styles.dateLbl}>Od</Text>
                <View style={styles.dateValWrap}>
                  <FontAwesome name="calendar" size={14} color={Colors.text} />
                  <Text style={styles.dateVal}>{fromIso ? fmtHrFromIso(fromIso) : "Odaberi"}</Text>
                </View>
              </Pressable>

              <Pressable
                style={[styles.datePill, active === "to" && styles.datePillActive, !toIso && styles.datePillEmpty]}
                onPress={() => openPicker("to")}
              >
                <Text style={styles.dateLbl}>Do</Text>
                <View style={styles.dateValWrap}>
                  <FontAwesome name="calendar" size={14} color={Colors.text} />
                  <Text style={styles.dateVal}>{toIso ? fmtHrFromIso(toIso) : "Odaberi"}</Text>
                </View>
              </Pressable>
            </View>

            {/* iOS inline picker */}
            {Platform.OS === "ios" && (
              <View style={styles.pickerBox}>
                <View style={styles.pickerTop}>
                  <Text style={styles.pickerTitle}>{active === "from" ? "Od" : "Do"}</Text>

                  <View style={styles.toggle}>
                    <Pressable style={[styles.tBtn, active === "from" && styles.tBtnActive]} onPress={() => setActive("from")}>
                      <Text style={[styles.tText, active === "from" && styles.tTextActive]}>Od</Text>
                    </Pressable>
                    <Pressable style={[styles.tBtn, active === "to" && styles.tBtnActive]} onPress={() => setActive("to")}>
                      <Text style={[styles.tText, active === "to" && styles.tTextActive]}>Do</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.iosPickerHeight}>
                  <DateTimePicker
                    value={pickerValue}
                    mode="date"
                    display="inline"
                    onChange={active === "from" ? onChangeFrom : onChangeTo}
                    themeVariant="light"
                    style={styles.iosPicker}
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

            {/* Quick presets */}
            <View style={styles.quickGrid}>
              {quickItems.map((it) => {
                const active = isQuickActive(it.key);
                return (
                  <Pressable key={it.key} style={[styles.qTile, active && styles.qTileActive]} onPress={() => quickPress(it.key)}>
                    <View style={[styles.qIconWrap, active && styles.qIconWrapActive]}>
                      <FontAwesome name={it.icon} size={16} color={active ? Colors.onPrimaryText : Colors.text} />
                    </View>

                    <View style={styles.flex1}>
                      <Text style={[styles.qTitle, active && styles.qTitleActive]} numberOfLines={1}>
                        {it.label}
                      </Text>
                      <Text style={[styles.qSub, active && styles.qSubActive]} numberOfLines={1}>
                        {it.key === "TODAY"
                          ? "Danas"
                          : it.key === "LAST7"
                            ? "Raspon 7 dana"
                            : it.key === "LAST30"
                              ? "Raspon 30 dana"
                              : it.key === "MONTH"
                                ? "Od 1. u mjesecu"
                                : it.key === "YEAR"
                                  ? "Cijela godina"
                                  : "Prikaži sve"}
                      </Text>
                    </View>

                    {!!it.meta && (
                      <View style={[styles.qBadge, active && styles.qBadgeActive]}>
                        <Text style={[styles.qBadgeText, active && styles.qBadgeTextActive]}>{it.meta}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.bodySpacer} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.secondary} onPress={clearAndClose}>
              <Text style={styles.secondaryText}>Očisti</Text>
            </Pressable>

            <Pressable style={styles.primary} onPress={apply}>
              <Text style={styles.primaryText}>Primijeni</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
