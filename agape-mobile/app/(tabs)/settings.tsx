import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, LayoutAnimation, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import Screen from "@/components/ui/Screen";
import TabScroll from "@/components/ui/TabScroll";
import { ErrorCard } from "@/components/ErrorCard";

import Strings from "@/src/constants/Strings";

import { useCurrentUser } from "../../src/api/hooks/common/useCurrentUser";
import { usePullToRefresh } from "../../src/api/hooks/common/usePullToRefresh";
import { useWarehouses } from "../../src/api/hooks/dashboard/useWarehouses";
import { useMainWarehouseSettingsForm } from "../../src/api/hooks/settings/useSettingsForm";

import WarehousePickerCard from "@/components/WarehousePickerCard";

import { styles as S } from "../../src/styles/SettingsScreen.styles";
import { toUserMessage } from "../../src/api/apiClient";

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

  const [retryingWarehouses, setRetryingWarehouses] = useState(false);
  const [hideTopError, setHideTopError] = useState(false);

  const savedDefaultRef = useRef<number | null>(savedDefault);
  useEffect(() => {
    savedDefaultRef.current = savedDefault;
  }, [savedDefault]);

  const resetToSavedRef = useRef(form.resetToSaved);
  useEffect(() => {
    resetToSavedRef.current = form.resetToSaved;
  }, [form.resetToSaved]);

  const refetchWarehousesRef = useRef(refetchWarehouses);
  useEffect(() => {
    refetchWarehousesRef.current = refetchWarehouses;
  }, [refetchWarehouses]);

  const whLoadingRef = useRef(whLoading);
  useEffect(() => {
    whLoadingRef.current = whLoading;
  }, [whLoading]);

  const whErrorRef = useRef<any>(whError);
  useEffect(() => {
    whErrorRef.current = whError;
  }, [whError]);

  const warehousesCountRef = useRef<number>(warehouses.length);
  useEffect(() => {
    warehousesCountRef.current = warehouses.length;
  }, [warehouses.length]);

  const toggleOpen = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => !prev);
  }, []);

  const retryWarehouses = useCallback(async () => {
    setHideTopError(true);
    setRetryingWarehouses(true);

    setOpen(false);
    form.clearStatus();

    try {
      await Promise.resolve(refetchWarehousesRef.current?.());
    } catch {
    } finally {
      setRetryingWarehouses(false);
      setHideTopError(false);
    }
  }, [form]);

  useFocusEffect(
    useCallback(() => {
      if (
        ready &&
        !whLoadingRef.current &&
        !whErrorRef.current &&
        warehousesCountRef.current === 0
      ) {
        void Promise.resolve(refetchWarehousesRef.current?.()).catch(() => { });
      }

      return () => {
        setOpen(false);
        setHideTopError(false);
        setRetryingWarehouses(false);
        resetToSavedRef.current(savedDefaultRef.current);
      };
    }, [ready])
  );

  const { refreshing, onRefresh } = usePullToRefresh([
    async () => {
      await retryWarehouses();
      resetToSavedRef.current(savedDefaultRef.current);
    },
  ]);

  const warehousesEmpty = useMemo(
    () => !whLoading && !whError && warehouses.length === 0,
    [whLoading, whError, warehouses.length]
  );

  const whErrorMessage = useMemo(() => (whError ? toUserMessage(whError) : null), [whError]);

  const topError = useMemo(() => form.errors.formError || whErrorMessage, [form.errors.formError, whErrorMessage]);
  const visibleTopError = useMemo(() => (hideTopError ? null : topError), [hideTopError, topError]);

  const topErrorActionText = useMemo(() => (whErrorMessage ? "Pokušaj ponovno" : "Zatvori"), [whErrorMessage]);

  const onTopErrorAction = useCallback(() => {
    if (whErrorMessage) {
      void retryWarehouses();
      return;
    }
    form.clearStatus();
  }, [whErrorMessage, retryWarehouses, form]);

  const selectedLabel = useMemo(() => {
    if (warehousesEmpty) return Strings.settings.mainWarehouse.empty;
    if (form.values.warehouseId == null) return Strings.settings.mainWarehouse.none;
    return Strings.home.warehouse.item(form.values.warehouseId);
  }, [warehousesEmpty, form.values.warehouseId]);

  if (!ready) {
    return (
      <Screen style={S.screen}>
        <View style={S.center}>
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["bottom", "left", "right"]} style={S.screen}>
      <TabScroll withScreen={false} refreshing={refreshing} onRefresh={onRefresh} contentContainerStyle={S.container}>
        <View style={S.card}>
          <Text style={S.title}>{Strings.settings.mainWarehouse.title}</Text>
          <Text style={S.sub}>{Strings.settings.mainWarehouse.subtitle}</Text>

          {!!form.successMessage ? (
            <View style={S.okPill}>
              <Text style={S.okPillText}>{form.successMessage}</Text>
            </View>
          ) : null}

          {!!visibleTopError ? (
            <View style={S.errorCardWrap}>
              <ErrorCard
                title="Greška"
                message={visibleTopError}
                actionText={topErrorActionText}
                onAction={onTopErrorAction}
                disabled={retryingWarehouses || refreshing}
                titleLines={1}
                messageLines={2}
              />
            </View>
          ) : null}

          <WarehousePickerCard
            style={{ marginTop: 10 }}
            labelText={Strings.settings.mainWarehouse.label}
            changeHintText={Strings.home.warehouse.changeHint}
            loadingText={Strings.settings.mainWarehouse.loading}
            emptyText={Strings.settings.mainWarehouse.empty}
            open={open}
            onToggle={toggleOpen}
            warehouses={warehouses}
            loading={whLoading || retryingWarehouses}
            error={null}
            onRetry={() => {
              void retryWarehouses();
            }}
            selectedId={form.values.warehouseId}
            selectedLabel={whLoading ? Strings.settings.mainWarehouse.loading : selectedLabel}
            onSelect={(id) => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              form.setWarehouseId(id);
              setOpen(false);
            }}
            itemLabel={(id) => Strings.home.warehouse.item(id)}
          />

          {!!form.errors.warehouseError ? <Text style={S.fieldErr}>{form.errors.warehouseError}</Text> : null}

          <Pressable
            onPress={form.submit}
            disabled={!form.canSubmit || form.submitting}
            style={({ pressed }) => [
              S.saveBtn,
              pressed && S.pressed,
              (!form.canSubmit || form.submitting) && S.disabled,
            ]}
          >
            {form.submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={S.saveText}>{Strings.settings.mainWarehouse.save}</Text>
            )}
          </Pressable>
        </View>
      </TabScroll>
    </Screen>
  );
}