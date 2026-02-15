import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, LayoutAnimation, Pressable, Text, View, Platform, UIManager } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFocusEffect } from "@react-navigation/native";

import Screen from "@/components/ui/Screen";
import TabScroll from "@/components/ui/TabScroll";
import { ErrorCard } from "@/components/ErrorCard";

import Strings from "@/constants/Strings";
import Colors from "@/constants/Colors";

import { useCurrentUser } from "@/app/api/hooks/useCurrentUser";
import { usePullToRefresh } from "@/app/api/hooks/common/usePullToRefresh";
import { useWarehouses } from "@/app/api/hooks/dashboard/useWarehouses";
import { useMainWarehouseSettingsForm } from "../api/hooks/settings/useSettingsForm";
import { styles } from "./styles/SettingsScreen.styles";

export default function SettingsScreen() {
  const { session, ready } = useCurrentUser();
  const userId = (session?.userId ?? null) as number | null;

  const warehousesQ = useWarehouses() as any;
  const warehouses: number[] = (warehousesQ?.data ?? []) as number[];
  const whLoading: boolean = !!warehousesQ?.isLoading;
  const whError = warehousesQ?.error;
  const refetchWarehouses = warehousesQ?.refetch;

  const savedDefault = (session?.defaultWarehouseId ?? null) as number | null;

  const form = useMainWarehouseSettingsForm({
    userId,
    savedWarehouseId: savedDefault,
  });

  const [open, setOpen] = useState(false);

  const savedDefaultRef = useRef<number | null>(savedDefault);
  useEffect(() => {
    savedDefaultRef.current = savedDefault;
  }, [savedDefault]);

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

  useEffect(() => {
    if (!ready) return;
    if (form.submitting) return;
    if (form.dirty) return;

    if (form.values.warehouseId === savedDefault) return;
    form.syncToSaved(savedDefault);
  }, [ready, savedDefault, form.submitting, form.dirty, form.values.warehouseId, form.syncToSaved]);

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
      await Promise.resolve(refetchWarehouses?.());
      resetToSavedRef.current(savedDefaultRef.current);
    },
  ]);

  if (!ready) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["bottom", "left", "right"]} style={styles.screen}>
      <TabScroll withScreen={false} refreshing={refreshing} onRefresh={onRefresh} contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>{Strings.settings.mainWarehouse.title}</Text>
          <Text style={styles.sub}>{Strings.settings.mainWarehouse.subtitle}</Text>

          {!!form.successMessage ? (
            <View style={styles.okPill}>
              <Text style={styles.okPillText}>{form.successMessage}</Text>
            </View>
          ) : null}

          {!!form.errors.formError ? (
            <View style={styles.errorCardWrap}>
              <ErrorCard
                title="Greška"
                message={form.errors.formError}
                actionText="Zatvori"
                onAction={form.clearStatus}
                titleLines={1}
                messageLines={2}
              />
            </View>
          ) : null}

          <Text style={styles.label}>{Strings.settings.mainWarehouse.label}</Text>

          <Pressable onPress={toggleOpen} style={({ pressed }) => [styles.select, pressed && styles.pressed]}>
            <View style={styles.selectLeft}>
              <View style={styles.iconBox}>
                <FontAwesome name="building" size={16} color={Colors.text} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.value} numberOfLines={1}>
                  {whLoading ? Strings.settings.mainWarehouse.loading : selectedLabel}
                </Text>
              </View>
            </View>

            <FontAwesome name={open ? "chevron-up" : "chevron-down"} size={16} color={Colors.sub} />
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
              ) : whError ? (
                <ErrorCard
                  title="Ne mogu učitati skladišta"
                  message={whError}
                  actionText="Pokušaj ponovno"
                  onAction={() => refetchWarehouses?.()}
                  titleLines={1}
                  messageLines={1}
                />
              ) : warehouses.length === 0 ? (
                <Text style={styles.rowText}>{Strings.settings.mainWarehouse.empty}</Text>
              ) : (
                warehouses.map((id: number) => {
                  const active = id === form.values.warehouseId;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        form.setWarehouseId(id);
                        setOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.item,
                        active && styles.itemActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.itemText}>{Strings.home.warehouse.item(id)}</Text>
                      {active ? <FontAwesome name="check" size={16} color={Colors.text} /> : null}
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
              pressed && styles.pressed,
              (!form.canSubmit || form.submitting) && styles.disabled,
            ]}
          >
            {form.submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{Strings.settings.mainWarehouse.save}</Text>}
          </Pressable>
        </View>
      </TabScroll>
    </Screen>
  );
}
