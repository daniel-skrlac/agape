import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, LayoutAnimation, Pressable, Text, View, useWindowDimensions } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFocusEffect, useRouter } from "expo-router";

import Screen from "../../components/ui/Screen";
import TabScroll from "@/components/ui/TabScroll";
import Strings from "../../constants/Strings";

import { useStockStatistics } from "../api/hooks/useStockStatistics";
import { useWarehouses } from "../api/hooks/useWarehouses";
import { useCurrentUser } from "../api/hooks/useCurrentUser";
import { useUserProfile } from "../api/hooks/useUserProfile";
import { usePullToRefresh } from "../api/hooks/usePullToRefresh";
import { formatIntHR, formatQtyHR, formatTimeHR } from "../utils/format";
import { styles, RIPPLE, T } from "./styles/HomeScreen.styles";
import { ErrorCard } from "@/components/ErrorCard";

type SectionKey = "missing" | "needsFill" | "most";

function useDefaultWarehouseId() {
  const { session } = useCurrentUser();
  const profile = useUserProfile();

  const defaultWarehouseId = useMemo(() => {
    return (
      ((session?.defaultWarehouseId ?? null) as number | null) ??
      ((profile.data?.defaultWarehouseId ?? null) as number | null) ??
      null
    );
  }, [session?.defaultWarehouseId, profile.data?.defaultWarehouseId]);

  return { session, profile, defaultWarehouseId };
}

function errMsg(e: any) {
  return String(e?.message ?? e?.error?.message ?? "Greška prilikom učitavanja.");
}

export default function HomeScreen() {
  const router = useRouter();

  const warehousesQuery = useWarehouses();

  const {
    data: warehousesRaw,
    isLoading: isWarehousesLoading,
    refetch: refetchWarehouses,
  } = warehousesQuery as unknown as {
    data: number[] | undefined;
    isLoading: boolean;
    refetch: () => Promise<any>;
  };

  const warehouses: number[] = warehousesRaw ?? [];
  const warehousesError = (warehousesQuery as any)?.error;

  const { session, profile, defaultWarehouseId } = useDefaultWarehouseId();

  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [warehouseOpen, setWarehouseOpen] = useState(false);

  const followsDefaultRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      followsDefaultRef.current = true;
      setWarehouseOpen(false);
      setWarehouseId(null);
      return () => {
        setWarehouseOpen(false);
      };
    }, [])
  );

  useEffect(() => {
    if (!followsDefaultRef.current) return;
    setWarehouseId(null);
  }, [defaultWarehouseId]);

  useEffect(() => {
    if (!warehouses?.length) return;

    if (!followsDefaultRef.current && warehouseId != null) return;

    const next =
      defaultWarehouseId != null && warehouses.includes(defaultWarehouseId) ? defaultWarehouseId : warehouses[0];

    if (warehouseId !== next) setWarehouseId(next);
  }, [warehouses, defaultWarehouseId, warehouseId]);

  const onSelectWarehouse = (id: number) => {
    followsDefaultRef.current = false;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setWarehouseId(id);
    setWarehouseOpen(false);
  };

  const toggleWarehouse = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setWarehouseOpen((p) => !p);
  };

  const stats = useStockStatistics(warehouseId);
  const { data, isLoading, isFetching, dataUpdatedAt } = stats as any;
  const statsError = (stats as any)?.error;

  const totals = data?.totals;

  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    missing: false,
    needsFill: false,
    most: false,
  });

  const toggle = (k: SectionKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const displayName = useMemo(() => {
    const n = session?.name?.trim();
    if (n) return n;
    const u = session?.username?.trim();
    if (u) return u;
    return Strings.home.fallbackName;
  }, [session]);

  const headerSubtitle = useMemo(() => {
    if (isLoading) return Strings.home.hero.subtitleLoading;
    return Strings.home.hero.subtitle;
  }, [isLoading]);

  const updatedText = useMemo(() => formatTimeHR(dataUpdatedAt), [dataUpdatedAt]);

  const missingItems = (data?.missing ?? []).slice(0, 12);
  const needsFillItems = (data?.needsFill ?? []).slice(0, 12);
  const mostItems = (data?.mostInStock ?? []).slice(0, 12);

  const selectedWarehouseLabel = useMemo(() => {
    if (warehouseId == null) return Strings.home.warehouse.none;
    return Strings.home.warehouse.item(warehouseId);
  }, [warehouseId]);

  const { refreshing, onRefresh } = usePullToRefresh([
    async () => {
      followsDefaultRef.current = true;
      setWarehouseId(null);
      setWarehouseOpen(false);

      await Promise.all([refetchWarehouses?.(), profile.refetch?.()]);
      await stats.refetch();
    },
  ]);

  const statsRefreshingInline = isFetching && !refreshing;

  return (
    <TabScroll
      refreshing={refreshing}
      onRefresh={onRefresh}
      contentContainerStyle={styles.content}
      overScrollMode="always"
      alwaysBounceVertical
      bounces
    >
      <Screen>
        <View style={styles.sectionGap}>
          <HeroCard
            routerPushProfile={() => router.push("/(tabs)/profile")}
            displayName={displayName}
            headerSubtitle={headerSubtitle}
            totalsQty={formatQtyHR(totals?.totalStockQty)}
            updatedText={updatedText}
          />
        </View>

        <View style={styles.sectionGap}>
          <Surface style={styles.whSurface}>
            <Pressable
              onPress={toggleWarehouse}
              android_ripple={{ color: RIPPLE }}
              style={({ pressed }) => [styles.whRow, pressed && styles.pressed]}
            >
              <View style={styles.whIcon}>
                <FontAwesome name="building" size={16} color={T.text} />
              </View>

              <View style={styles.flex1}>
                <Text style={styles.whLabel}>{Strings.home.warehouse.label}</Text>
                <Text style={styles.whValue} numberOfLines={1}>
                  {isWarehousesLoading ? Strings.home.warehouse.loading : selectedWarehouseLabel}
                </Text>

                {statsRefreshingInline ? (
                  <View style={styles.whLoadingRow}>
                    <ActivityIndicator size="small" />
                    <Text style={styles.whLoadingInline} numberOfLines={1} />
                  </View>
                ) : null}
              </View>

              <View style={styles.whRight}>
                <Text style={styles.whHint} numberOfLines={1}>
                  {Strings.home.warehouse.changeHint}
                </Text>
                <FontAwesome name={warehouseOpen ? "chevron-up" : "chevron-down"} size={16} color={T.muted} />
              </View>
            </Pressable>

            {warehouseOpen ? <View style={styles.whDivider} /> : null}

            {warehouseOpen ? (
              <View style={styles.whDropdown}>
                {isWarehousesLoading ? (
                  <View style={styles.whDropdownLoading}>
                    <ActivityIndicator size="small" />
                    <Text style={styles.whDropdownLoadingText}>{Strings.home.warehouse.loading}</Text>
                  </View>
                ) : warehousesError ? (
                  <View style={styles.whDropdownLoading}>
                    <ErrorCard
                      title="Ne mogu učitati skladišta"
                      message={errMsg(warehousesError)}
                      actionText="Pokušaj ponovno"
                      onAction={() => refetchWarehouses?.()}
                      messageLines={1}
                    />
                  </View>
                ) : warehouses.length === 0 ? (
                  <View style={styles.whDropdownEmpty}>
                    <Text style={styles.whDropdownEmptyText}>{Strings.home.warehouse.empty}</Text>
                  </View>
                ) : (
                  <View style={styles.whDropdownList}>
                    {warehouses.map((id: number) => {
                      const active = id === warehouseId;
                      return (
                        <Pressable
                          key={id}
                          onPress={() => onSelectWarehouse(id)}
                          android_ripple={{ color: RIPPLE }}
                          style={({ pressed }) => [
                            styles.whItem,
                            active ? styles.whItemActive : styles.whItemIdle,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.whItemText}>{Strings.home.warehouse.item(id)}</Text>
                          {active ? <FontAwesome name="check" size={16} color={T.text} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}
          </Surface>
        </View>

        <View style={styles.sectionGap}>
          <View style={styles.metricsGrid}>
            <MetricTile
              icon="cubes"
              title={Strings.home.metrics.totalItems}
              value={formatIntHR(totals?.totalItems)}
              tone="neutral"
            />
            <MetricTile
              icon="exclamation-circle"
              title={Strings.home.metrics.missing}
              value={formatIntHR(totals?.missingCount)}
              tone="warm"
            />
            <MetricTile
              icon="arrow-up"
              title={Strings.home.metrics.needsFill}
              value={formatIntHR(totals?.needsFillCount)}
              tone="warm"
            />
            <MetricTile
              icon="bookmark"
              title={Strings.home.metrics.reserved}
              value={formatIntHR(totals?.reservedCount)}
              tone="cool"
            />
          </View>
        </View>

        <View style={styles.sectionGapStack}>
          <Accordion
            icon="exclamation-circle"
            tone="warm"
            title={Strings.home.sections.missingTitle}
            subtitle={Strings.home.sections.missingSub}
            count={data?.missing?.length ?? 0}
            open={open.missing}
            onPress={() => toggle("missing")}
          >
            {isLoading ? (
              <EmptyLine text={Strings.home.empty.loading} />
            ) : warehouseId == null && warehousesError ? (
              <ErrorCard
                title="Ne mogu učitati skladišta"
                message={errMsg(warehousesError)}
                actionText="Pokušaj ponovno"
                onAction={() => refetchWarehouses?.()}
                messageLines={1}
              />
            ) : statsError ? (
              <ErrorCard
                title="Ne mogu učitati statistiku"
                message={errMsg(statsError)}
                actionText="Pokušaj ponovno"
                onAction={() => stats.refetch()}
                messageLines={1}
              />
            ) : missingItems.length === 0 ? (
              <EmptyLine text={Strings.home.empty.bySegment.missing} />
            ) : (
              <ListCard>
                {missingItems.map((it: any, idx: number) => (
                  <StockRow
                    key={`${it.itemId}-${it.warehouseId}`}
                    name={it.name}
                    code={`${Strings.home.labels.code}: ${it.itemCode}`}
                    rightTop={`${formatQtyHR(it.currentQty)} ${it.unit ?? Strings.home.labels.pcs}`.trim()}
                    rightBottom={Strings.home.rowHints.missing}
                    badgeTone="warm"
                    divider={idx < missingItems.length - 1}
                  />
                ))}
              </ListCard>
            )}
          </Accordion>

          <Accordion
            icon="arrow-up"
            tone="warm"
            title={Strings.home.sections.needsFillTitle}
            subtitle={Strings.home.sections.needsFillSub}
            count={data?.needsFill?.length ?? 0}
            open={open.needsFill}
            onPress={() => toggle("needsFill")}
          >
            {isLoading ? (
              <EmptyLine text={Strings.home.empty.loading} />
            ) : warehouseId == null && warehousesError ? (
              <ErrorCard
                title="Ne mogu učitati skladišta"
                message={errMsg(warehousesError)}
                actionText="Pokušaj ponovno"
                onAction={() => refetchWarehouses?.()}
                messageLines={1}
              />
            ) : statsError ? (
              <ErrorCard
                title="Ne mogu učitati statistiku"
                message={errMsg(statsError)}
                actionText="Pokušaj ponovno"
                onAction={() => stats.refetch()}
                messageLines={1}
              />
            ) : needsFillItems.length === 0 ? (
              <EmptyLine text={Strings.home.empty.bySegment.needsFill} />
            ) : (
              <ListCard>
                {needsFillItems.map((it: any, idx: number) => (
                  <StockRow
                    key={`${it.itemId}-${it.warehouseId}`}
                    name={it.name}
                    code={`${Strings.home.labels.code}: ${it.itemCode}`}
                    rightTop={`${formatQtyHR(it.currentQty)} / ${formatQtyHR(it.minimalQty)}`}
                    rightBottom={Strings.home.rowHints.needsFill}
                    badgeTone="warm"
                    divider={idx < needsFillItems.length - 1}
                  />
                ))}
              </ListCard>
            )}
          </Accordion>

          <Accordion
            icon="check-circle"
            tone="cool"
            title={Strings.home.sections.mostTitle}
            subtitle={Strings.home.sections.mostSub}
            count={data?.mostInStock?.length ?? 0}
            open={open.most}
            onPress={() => toggle("most")}
          >
            {isLoading ? (
              <EmptyLine text={Strings.home.empty.loading} />
            ) : warehouseId == null && warehousesError ? (
              <ErrorCard
                title="Ne mogu učitati skladišta"
                message={errMsg(warehousesError)}
                actionText="Pokušaj ponovno"
                onAction={() => refetchWarehouses?.()}
                messageLines={1}
              />
            ) : statsError ? (
              <ErrorCard
                title="Ne mogu učitati statistiku"
                message={errMsg(statsError)}
                actionText="Pokušaj ponovno"
                onAction={() => stats.refetch()}
                messageLines={1}
              />
            ) : mostItems.length === 0 ? (
              <EmptyLine text={Strings.home.empty.bySegment.most} />
            ) : (
              <ListCard>
                {mostItems.map((it: any, idx: number) => (
                  <StockRow
                    key={`${it.itemId}-${it.warehouseId}`}
                    name={it.name}
                    code={`${Strings.home.labels.code}: ${it.itemCode}`}
                    rightTop={`${formatQtyHR(it.currentQty)} ${it.unit ?? Strings.home.labels.pcs}`.trim()}
                    rightBottom={Strings.home.rowHints.most}
                    badgeTone="cool"
                    divider={idx < mostItems.length - 1}
                  />
                ))}
              </ListCard>
            )}
          </Accordion>
        </View>

        <View style={styles.bottomSpacer} />
      </Screen>
    </TabScroll>
  );
}

function HeroCard(props: {
  routerPushProfile: () => void;
  displayName: string;
  headerSubtitle: string;
  totalsQty: string;
  updatedText: string;
}) {
  return (
    <View style={styles.heroWrap}>
      <View style={styles.heroBgCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroAccentDot} />
          <Text style={styles.heroBadge}>{Strings.home.hero.eyebrow}</Text>
        </View>

        <View style={styles.heroRow}>
          <View style={styles.flex1}>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {Strings.home.hero.title(props.displayName)}
            </Text>
            <Text style={styles.heroSubtitle}>{props.headerSubtitle}</Text>
          </View>

          <Pressable onPress={props.routerPushProfile} style={styles.avatar}>
            <FontAwesome name="user" size={18} color={T.text} />
          </Pressable>
        </View>

        <View style={styles.kpiRow}>
          <KpiChip icon="archive" label={Strings.home.meta.totalQty} value={props.totalsQty} />
          <KpiChip icon="clock-o" label={Strings.home.meta.updatedAt} value={props.updatedText} />
        </View>
      </View>
    </View>
  );
}

function Surface({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

function KpiChip(props: { icon: React.ComponentProps<typeof FontAwesome>["name"]; label: string; value: string }) {
  return (
    <View style={styles.kpiChip}>
      <View style={styles.kpiChipIcon}>
        <FontAwesome name={props.icon} size={14} color={T.text} />
      </View>
      <View style={styles.flex1}>
        <Text style={styles.kpiChipLabel} numberOfLines={1}>
          {props.label}
        </Text>
        <Text style={styles.kpiChipValue} numberOfLines={1}>
          {props.value}
        </Text>
      </View>
    </View>
  );
}

function MetricTile(props: {
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  title: string;
  value: string;
  tone: "neutral" | "warm" | "cool";
  fullWidth?: boolean;
}) {
  const bg =
    props.tone === "warm" ? styles.metricWarm : props.tone === "cool" ? styles.metricCool : styles.metricNeutral;
  const iconBg =
    props.tone === "warm" ? styles.metricIconWarm : props.tone === "cool" ? styles.metricIconCool : styles.metricIconNeut;
  const border =
    props.tone === "warm"
      ? styles.metricBorderWarm
      : props.tone === "cool"
        ? styles.metricBorderCool
        : styles.metricBorderNeutral;

  return (
    <View style={[styles.metricTile, bg, border, props.fullWidth && styles.fullWidthCard]}>
      <View style={[styles.metricIcon, iconBg]}>
        <FontAwesome name={props.icon} size={16} color={T.text} />
      </View>
      <Text style={styles.metricTitle} numberOfLines={1}>
        {props.title}
      </Text>
      <Text style={styles.metricValue} numberOfLines={1}>
        {props.value}
      </Text>
    </View>
  );
}

function Accordion(props: {
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  tone: "warm" | "cool";
  title: string;
  subtitle: string;
  count: number;
  open: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const iconTone = props.tone === "warm" ? styles.accIconWarm : styles.accIconCool;

  return (
    <Surface style={styles.accSurface}>
      <Pressable
        onPress={props.onPress}
        android_ripple={{ color: RIPPLE }}
        style={({ pressed }) => [styles.accHeader, pressed && styles.pressed]}
      >
        <View style={[styles.accIcon, iconTone]}>
          <FontAwesome name={props.icon} size={16} color={T.text} />
        </View>

        <View style={styles.flex1}>
          <Text style={styles.accTitle} numberOfLines={1}>
            {props.title}
          </Text>
          <Text style={styles.accSub} numberOfLines={1}>
            {props.subtitle}
          </Text>
        </View>

        <View style={styles.accRight}>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{formatIntHR(props.count)}</Text>
          </View>
          <FontAwesome name={props.open ? "chevron-up" : "chevron-down"} size={16} color={T.muted} />
        </View>
      </Pressable>

      <View style={styles.accDivider} />

      {props.open ? <View style={styles.accBody}>{props.children}</View> : null}
    </Surface>
  );
}

function ListCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.listCard}>{children}</View>;
}

function StockRow(props: {
  name: string;
  code: string;
  rightTop: string;
  rightBottom: string;
  badgeTone: "warm" | "cool";
  divider?: boolean;
}) {
  const badge = props.badgeTone === "warm" ? styles.qtyWarm : styles.qtyCool;

  return (
    <View style={[styles.row, props.divider && styles.rowDivider]}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowName} numberOfLines={2}>
          {props.name}
        </Text>
        <Text style={styles.rowCode} numberOfLines={1}>
          {props.code}
        </Text>
      </View>

      <View style={styles.rowRight}>
        <View style={[styles.qtyBadge, badge]}>
          <Text style={styles.qtyText} numberOfLines={1}>
            {props.rightTop}
          </Text>
        </View>
        <Text style={styles.rowHint} numberOfLines={1}>
          {props.rightBottom}
        </Text>
      </View>
    </View>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}
