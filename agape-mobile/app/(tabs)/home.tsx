import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
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

type SectionKey = "missing" | "needsFill" | "most";

const T = {
  surface: "#FFFFFF",
  text: "#0B1220",
  subText: "#1F2A37",
  muted: "#475569",

  border: "rgba(2, 6, 23, 0.16)",
  borderStrong: "rgba(2, 6, 23, 0.22)",
  divider: "rgba(2, 6, 23, 0.12)",

  warmBadge: "#FFD3B8",
  coolBadge: "#CFE2FF",

  warmAccent: "#F97316",
  coolAccent: "#2563EB",
  neutralAccent: "#0B1220",

  heroBg: "#FFF4EC",
  heroCardBg: "rgba(255,255,255,0.72)",

  shadow: "#000000",
};

const H_PADDING = 16;

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

export default function HomeScreen() {
  useWindowDimensions();

  const router = useRouter();
  const { data: warehouses, isLoading: isWarehousesLoading, refetch: refetchWarehouses } = useWarehouses();

  const { session, profile, defaultWarehouseId } = useDefaultWarehouseId();

  // local-only selection for this screen
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [warehouseOpen, setWarehouseOpen] = useState(false);

  // if user didn't manually choose -> follow default
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
      defaultWarehouseId != null && warehouses.includes(defaultWarehouseId)
        ? defaultWarehouseId
        : warehouses[0];

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
  const { data, isLoading, isFetching, dataUpdatedAt } = stats;

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

      // "each view fetches if needed"
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
              android_ripple={{ color: "rgba(2,6,23,0.08)" }}
              style={({ pressed }) => [styles.whRow, pressed && styles.pressed]}
            >
              <View style={styles.whIcon}>
                <FontAwesome name="building" size={16} color={T.text} />
              </View>

              <View style={{ flex: 1 }}>
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
                ) : (warehouses ?? []).length === 0 ? (
                  <View style={styles.whDropdownEmpty}>
                    <Text style={styles.whDropdownEmptyText}>{Strings.home.warehouse.empty}</Text>
                  </View>
                ) : (
                  <View style={styles.whDropdownList}>
                    {(warehouses ?? []).map((id) => {
                      const active = id === warehouseId;
                      return (
                        <Pressable
                          key={id}
                          onPress={() => onSelectWarehouse(id)}
                          android_ripple={{ color: "rgba(2,6,23,0.08)" }}
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
            <MetricTile icon="cubes" title={Strings.home.metrics.totalItems} value={formatIntHR(totals?.totalItems)} tone="neutral" />
            <MetricTile icon="exclamation-circle" title={Strings.home.metrics.missing} value={formatIntHR(totals?.missingCount)} tone="warm" />
            <MetricTile icon="arrow-up" title={Strings.home.metrics.needsFill} value={formatIntHR(totals?.needsFillCount)} tone="warm" />
            <MetricTile icon="bookmark" title={Strings.home.metrics.reserved} value={formatIntHR(totals?.reservedCount)} tone="cool" />
          </View>
        </View>

        <View style={[styles.sectionGap, { gap: 14 }]}>
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
            ) : missingItems.length === 0 ? (
              <EmptyLine text={Strings.home.empty.bySegment.missing} />
            ) : (
              <ListCard>
                {missingItems.map((it, idx) => (
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
            ) : needsFillItems.length === 0 ? (
              <EmptyLine text={Strings.home.empty.bySegment.needsFill} />
            ) : (
              <ListCard>
                {needsFillItems.map((it, idx) => (
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
            ) : mostItems.length === 0 ? (
              <EmptyLine text={Strings.home.empty.bySegment.most} />
            ) : (
              <ListCard>
                {mostItems.map((it, idx) => (
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

        <View style={{ height: 26 }} />
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
          <View style={{ flex: 1 }}>
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
      <View style={{ flex: 1 }}>
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
  const bg = props.tone === "warm" ? styles.metricWarm : props.tone === "cool" ? styles.metricCool : styles.metricNeutral;
  const iconBg = props.tone === "warm" ? styles.metricIconWarm : props.tone === "cool" ? styles.metricIconCool : styles.metricIconNeut;
  const accent = props.tone === "warm" ? T.warmAccent : props.tone === "cool" ? T.coolAccent : T.neutralAccent;

  return (
    <View style={[styles.metricTile, bg, { borderLeftColor: accent }, props.fullWidth && styles.fullWidthCard]}>
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
        android_ripple={{ color: "rgba(2,6,23,0.08)" }}
        style={({ pressed }) => [styles.accHeader, pressed && styles.pressed]}
      >
        <View style={[styles.accIcon, iconTone]}>
          <FontAwesome name={props.icon} size={16} color={T.text} />
        </View>

        <View style={{ flex: 1 }}>
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

const styles = StyleSheet.create({
  content: { paddingHorizontal: H_PADDING, paddingTop: 12, paddingBottom: 30, flexGrow: 1 },
  sectionGap: { marginBottom: 14 },

  surface: {
    borderRadius: 22,
    backgroundColor: T.surface,
    borderWidth: 1.25,
    borderColor: T.border,
    shadowColor: T.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
    overflow: "hidden",
  },

  heroWrap: { borderRadius: 26, overflow: "hidden" },
  heroBgCard: {
    borderRadius: 26,
    backgroundColor: T.heroBg,
    borderWidth: 1.25,
    borderColor: T.border,
    padding: 16,
  },

  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  heroAccentDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: T.warmAccent },
  heroBadge: { fontSize: 12, fontWeight: "900", letterSpacing: 0.6, color: T.muted },

  heroRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroTitle: { marginTop: 2, fontSize: 24, fontWeight: "900", color: T.text },
  heroSubtitle: { marginTop: 8, fontSize: 14, lineHeight: 20, color: T.subText, maxWidth: 360 },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },

  kpiRow: { marginTop: 14, flexDirection: "row", gap: 12 },
  kpiChip: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: T.heroCardBg,
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  kpiChipIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiChipLabel: { fontSize: 12, fontWeight: "900", color: T.muted },
  kpiChipValue: { marginTop: 2, fontSize: 14, fontWeight: "900", color: T.text },

  fullWidthCard: { width: "100%" },

  whSurface: { borderColor: T.borderStrong },
  whRow: { padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  whIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "#FFF2E8",
    borderWidth: 1.25,
    borderColor: "rgba(249,115,22,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  whLabel: { fontSize: 12, fontWeight: "900", color: T.muted },
  whValue: { marginTop: 3, fontSize: 15, fontWeight: "900", color: T.text },
  whRight: { alignItems: "flex-end", gap: 6 },
  whHint: { fontSize: 12, color: T.subText },

  whLoadingRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  whLoadingInline: { fontSize: 12, color: T.subText },

  whDivider: { height: 1, backgroundColor: T.divider },

  whDropdown: { padding: 14, backgroundColor: "#FFFFFF" },
  whDropdownList: { gap: 10 },
  whDropdownLoading: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  whDropdownLoadingText: { fontSize: 14, color: T.subText },
  whDropdownEmpty: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    backgroundColor: "#FFFFFF",
  },
  whDropdownEmptyText: { fontSize: 14, color: T.subText, lineHeight: 20 },

  whItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  whItemIdle: {},
  whItemActive: { backgroundColor: "#FFF2E8", borderColor: "rgba(249,115,22,0.40)" },
  whItemText: { fontSize: 14, fontWeight: "900", color: T.text },

  pressed: { opacity: 0.97 },

  metricsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  metricTile: {
    width: "48%",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    borderLeftWidth: 5,
    shadowColor: T.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  metricNeutral: { backgroundColor: "#FFFFFF" },
  metricWarm: { backgroundColor: "#FFF6EF" },
  metricCool: { backgroundColor: "#F3F7FF" },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  metricIconNeut: { backgroundColor: "#FFFFFF" },
  metricIconWarm: { backgroundColor: "#FFF2E8" },
  metricIconCool: { backgroundColor: "#DFEAFF" },
  metricTitle: { fontSize: 12, fontWeight: "900", color: T.muted },
  metricValue: { marginTop: 6, fontSize: 22, fontWeight: "900", color: T.text },

  accSurface: { borderColor: T.borderStrong },
  accHeader: { padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },

  accIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.25,
    borderColor: T.borderStrong,
  },
  accIconWarm: { backgroundColor: T.warmBadge },
  accIconCool: { backgroundColor: T.coolBadge },

  accTitle: { fontSize: 15, fontWeight: "900", color: T.text },
  accSub: { marginTop: 3, fontSize: 12, color: "rgba(15,23,42,0.78)" },

  accRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  countPill: {
    minWidth: 54,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(2,6,23,0.06)",
    borderWidth: 1.25,
    borderColor: T.divider,
    alignItems: "center",
    justifyContent: "center",
  },
  countPillText: { fontSize: 12, fontWeight: "900", color: "#000000" },

  accDivider: { height: 0, backgroundColor: T.divider },
  accBody: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 14, backgroundColor: "#FFFFFF" },

  listCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.25,
    borderColor: T.borderStrong,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "flex-start",
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: T.divider },
  rowLeft: { flex: 1 },
  rowName: { fontSize: 13, lineHeight: 17, fontWeight: "900", color: T.text },
  rowCode: { marginTop: 3, fontSize: 11, color: T.muted },

  rowRight: { alignItems: "flex-end" },
  qtyBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1.25, borderColor: "rgba(2,6,23,0.22)" },
  qtyWarm: { backgroundColor: T.warmBadge },
  qtyCool: { backgroundColor: T.coolBadge },
  qtyText: { fontSize: 11, fontWeight: "900", color: T.text },
  rowHint: { marginTop: 4, fontSize: 11, color: T.subText },

  empty: { paddingVertical: 14, paddingHorizontal: 12, backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1.25, borderColor: T.borderStrong },
  emptyText: { fontSize: 14, color: T.subText, lineHeight: 20 },
});
