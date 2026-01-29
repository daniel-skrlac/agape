import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, LayoutAnimation, Pressable, StyleSheet, Text, View, Platform, UIManager } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFocusEffect } from "@react-navigation/native";

import Screen from "@/components/ui/Screen";
import TabScroll from "@/components/ui/TabScroll";
import Strings from "@/constants/Strings";

import { useCurrentUser } from "@/app/api/hooks/useCurrentUser";
import { useWarehouses } from "@/app/api/hooks/useWarehouses";
import { useUserProfile } from "../api/hooks/useUserProfile";
import { useMainWarehouseSettings } from "../api/hooks/useMainWarehouseSettingsForm";
import { usePullToRefresh } from "../api/hooks/usePullToRefresh";

const T = {
  text: "#0B1220",
  muted: "#475569",
  border: "rgba(2, 6, 23, 0.16)",
  divider: "rgba(2, 6, 23, 0.12)",
  surface: "rgba(255,255,255,0.78)",
  orange: "#F97316",
};

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SettingsScreen() {
  const { session, ready } = useCurrentUser();
  const userId = session?.userId ?? null;

  const { data: warehouses, isLoading: whLoading, refetch: refetchWarehouses } = useWarehouses();
  const profile = useUserProfile();

  const form = useMainWarehouseSettings({
    userId,
    sessionDefaultWarehouseId: (session?.defaultWarehouseId ?? null) as number | null,
  });

  const [open, setOpen] = useState(false);

  // source-of-truth saved default (session wins, fallback profile)
  const savedDefault = useMemo(() => {
    return (
      ((session?.defaultWarehouseId ?? null) as number | null) ??
      ((profile.data?.defaultWarehouseId ?? null) as number | null) ??
      null
    );
  }, [session?.defaultWarehouseId, profile.data?.defaultWarehouseId]);

  // keep latest savedDefault for blur/reset
  const savedDefaultRef = useRef<number | null>(savedDefault);
  useEffect(() => {
    savedDefaultRef.current = savedDefault;
  }, [savedDefault]);

  // keep latest reset fn (avoid unstable deps closing dropdown)
  const resetToSavedRef = useRef(form.resetToSaved);
  useEffect(() => {
    resetToSavedRef.current = form.resetToSaved;
  }, [form.resetToSaved]);

  const selectedLabel = useMemo(() => {
    if (form.values.warehouseId == null) return Strings.settings.mainWarehouse.none;
    return Strings.home.warehouse.item(form.values.warehouseId);
  }, [form.values.warehouseId]);

  const toggleOpen = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => !prev);
  }, []);

  // sync form value to saved default (only if user didn't touch)
  useEffect(() => {
    if (!ready) return;
    if (form.submitting) return;
    if (form.touched) return;

    if (form.values.warehouseId === savedDefault) return;

    form.syncToSaved(savedDefault);
  }, [ready, savedDefault, form.submitting, form.touched, form.values.warehouseId, form.syncToSaved]);

  // ✅ FIX: stable focus effect; cleanup only runs on actual blur/unmount
  useFocusEffect(
    useCallback(() => {
      return () => {
        setOpen(false);
        resetToSavedRef.current(savedDefaultRef.current);
      };
    }, [])
  );

  const { refreshing, onRefresh } = usePullToRefresh([
    async () => {
      setOpen(false);
      form.clearStatus();

      await Promise.all([refetchWarehouses?.(), profile.refetch?.()]);

      resetToSavedRef.current(savedDefaultRef.current);
    },
  ]);

  if (!ready) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["bottom", "left", "right"]}>
      <TabScroll refreshing={refreshing} onRefresh={onRefresh} contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>{Strings.settings.mainWarehouse.title}</Text>
          <Text style={styles.sub}>{Strings.settings.mainWarehouse.subtitle}</Text>

          {!!form.successMessage ? (
            <View style={styles.bannerOk}>
              <Text style={styles.bannerOkText}>{form.successMessage}</Text>
            </View>
          ) : null}

          {!!form.errors.formError ? (
            <View style={styles.bannerErr}>
              <Text style={styles.bannerErrText}>{form.errors.formError}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>{Strings.settings.mainWarehouse.label}</Text>

          <Pressable onPress={toggleOpen} style={({ pressed }) => [styles.select, pressed && { opacity: 0.95 }]}>
            <View style={styles.selectLeft}>
              <View style={styles.iconBox}>
                <FontAwesome name="building" size={16} color={T.text} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.value} numberOfLines={1}>
                  {whLoading ? Strings.settings.mainWarehouse.loading : selectedLabel}
                </Text>
              </View>
            </View>

            <FontAwesome name={open ? "chevron-up" : "chevron-down"} size={16} color={T.muted} />
          </Pressable>

          {!!form.errors.warehouseError ? <Text style={styles.fieldErr}>{form.errors.warehouseError}</Text> : null}

          {open ? <View style={styles.divider} /> : null}

          {open ? (
            <View style={styles.dropdown}>
              {whLoading ? (
                <View style={styles.row}>
                  <ActivityIndicator size="small" />
                  <Text style={styles.rowText}>{Strings.settings.mainWarehouse.loading}</Text>
                </View>
              ) : (warehouses ?? []).length === 0 ? (
                <Text style={styles.rowText}>{Strings.settings.mainWarehouse.empty}</Text>
              ) : (
                (warehouses ?? []).map((id: number) => {
                  const active = id === form.values.warehouseId;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        form.setWarehouseId(id);
                        setOpen(false);
                      }}
                      style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && { opacity: 0.95 }]}
                    >
                      <Text style={styles.itemText}>{Strings.home.warehouse.item(id)}</Text>
                      {active ? <FontAwesome name="check" size={16} color={T.text} /> : null}
                    </Pressable>
                  );
                })
              )}
            </View>
          ) : null}

          <Pressable
            onPress={form.submit}
            disabled={!form.canSubmit || form.submitting}
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && { opacity: 0.92 },
              (!form.canSubmit || form.submitting) && { opacity: 0.6 },
            ]}
          >
            {form.submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{Strings.settings.mainWarehouse.save}</Text>}
          </Pressable>
        </View>
      </TabScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18 },

  card: {
    backgroundColor: T.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
  },

  title: { fontSize: 18, fontWeight: "900", color: T.text },
  sub: { marginTop: 6, fontSize: 13, color: "rgba(15,23,42,0.72)" },

  bannerOk: {
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(34,197,94,0.10)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
  },
  bannerOkText: { fontSize: 13, fontWeight: "800", color: "rgba(21,128,61,0.95)" },

  bannerErr: {
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
  },
  bannerErrText: { fontSize: 13, fontWeight: "800", color: "rgba(185,28,28,0.95)" },

  label: { marginTop: 14, fontSize: 12, fontWeight: "900", color: "rgba(15,23,42,0.72)" },

  select: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1.25,
    borderColor: "rgba(2,6,23,0.22)",
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },

  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.35)",
    backgroundColor: "rgba(249,115,22,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  value: { fontSize: 14, fontWeight: "900", color: T.text },

  fieldErr: { marginTop: 8, fontSize: 12, fontWeight: "700", color: "rgba(185,28,28,0.95)" },
  divider: { height: 1, backgroundColor: T.divider, marginTop: 12 },

  dropdown: { marginTop: 12, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowText: { fontSize: 14, color: "rgba(15,23,42,0.75)" },

  item: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.25,
    borderColor: "rgba(2,6,23,0.22)",
    backgroundColor: "rgba(255,255,255,0.85)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemActive: { backgroundColor: "rgba(249,115,22,0.10)", borderColor: "rgba(249,115,22,0.35)" },
  itemText: { fontSize: 14, fontWeight: "900", color: T.text },

  saveBtn: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: T.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontSize: 14, fontWeight: "900", color: "#fff" },
});
