import React, { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import Screen from "../../components/ui/Screen";
import AuthBackground from "@/components/auth/AuthBackground";
import Strings from "../../constants/Strings";

import { useStockStatistics } from "../api/hooks/useStockStatistics";
import { useWarehouses } from "../api/hooks/useWarehouses";
import { useCurrentUser } from "../api/hooks/useCurrentUser";
import { formatIntHR, formatQtyHR, formatTimeHR } from "../utils/format";

type SectionKey = "missing" | "needsFill" | "most";

const T = {
  surface: "#FFFFFF",

  text: "#0B1220",
  subText: "#1F2A37",
  muted: "#475569",

  border: "rgba(2, 6, 23, 0.30)",
  borderStrong: "rgba(2, 6, 23, 0.42)",
  divider: "rgba(2, 6, 23, 0.22)",

  pill: "#0B1220",
  pillText: "#FFFFFF",

  warmHeader: "#FFD6BE",
  warmIcon: "#FFB389",
  warmBadge: "#FFC9A8",
  warmAccent: "#EA580C",

  coolHeader: "#CFE3FF",
  coolIcon: "#9EC5FF",
  coolBadge: "#B6D7FF",
  coolAccent: "#2563EB",

  neutralAccent: "#0B1220",

  heroBg: "#FFF4EC",
  heroBorder: "rgba(2, 6, 23, 0.26)",
  heroCardBg: "#FFFFFF",

  shadow: "#000000",
};

const H_PADDING = 14;

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function HomeScreen() {
  useWindowDimensions();

  const { session } = useCurrentUser();
  const { data: warehouses, isLoading: isWarehousesLoading } = useWarehouses();

  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  useEffect(() => {
    if (warehouseId == null && warehouses && warehouses.length > 0) {
      setWarehouseId(warehouses[0]);
    }
  }, [warehouses, warehouseId]);

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useStockStatistics(warehouseId);
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

  const toggleWarehouse = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setWarehouseOpen((p) => !p);
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

  const insight = useMemo(() => {
    if (isLoading) return Strings.home.insight.loading;

    const needsFill = totals?.needsFillCount ?? 0;
    const missing = totals?.missingCount ?? 0;
    const priority = needsFill + missing;

    if (priority <= 0) return Strings.home.insight.allGood;
    return Strings.home.insight.priority(formatIntHR(priority));
  }, [isLoading, totals]);

  const updatedText = useMemo(() => formatTimeHR(dataUpdatedAt), [dataUpdatedAt]);

  const missingItems = (data?.missing ?? []).slice(0, 12);
  const needsFillItems = (data?.needsFill ?? []).slice(0, 12);
  const mostItems = (data?.mostInStock ?? []).slice(0, 12);

  const selectedWarehouseLabel = useMemo(() => {
    if (warehouseId == null) return Strings.home.warehouse.none;
    return Strings.home.warehouse.item(warehouseId);
  }, [warehouseId]);

  const onPullRefresh = async () => {
    setIsPullRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsPullRefreshing(false);
    }
  };

  const statsRefreshingInline = isFetching && !isPullRefreshing;

  return (
    <AuthBackground>
      <Screen>
        <ScrollView
          contentContainerStyle={styles.content}
          overScrollMode="always"
          alwaysBounceVertical
          bounces
          refreshControl={
            <RefreshControl
              refreshing={isPullRefreshing}
              onRefresh={onPullRefresh}
              progressViewOffset={10}
              tintColor={"#F97316"}
              colors={["#F97316"]}
              progressBackgroundColor="#FFFFFF"
            />
          }
        >
          <Surface style={styles.hero}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroAccentDot} />
              <Text style={styles.heroBadge}>{Strings.home.hero.eyebrow}</Text>
            </View>

            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle} numberOfLines={1}>
                  {Strings.home.hero.title(displayName)}
                </Text>
                <Text style={styles.heroSubtitle}>{headerSubtitle}</Text>
              </View>

              <View style={styles.avatar}>
                <FontAwesome name="user" size={18} color={T.text} />
              </View>
            </View>

            <View style={styles.kpiWrap}>
              <KpiCard icon="archive" label={Strings.home.meta.totalQty} value={formatQtyHR(totals?.totalStockQty)} />
              <KpiCard icon="clock-o" label={Strings.home.meta.updatedAt} value={updatedText} />
            </View>
          </Surface>

          <Surface style={styles.whSurface}>
            <Pressable
              onPress={toggleWarehouse}
              android_ripple={{ color: "rgba(2,6,23,0.10)" }}
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
                    <Text style={styles.whLoadingInline} numberOfLines={1}>
                      {Strings.home.warehouse.statsLoading}
                    </Text>
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
                          onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setWarehouseId(id);
                            setWarehouseOpen(false);
                          }}
                          android_ripple={{ color: "rgba(2,6,23,0.10)" }}
                          style={({ pressed }) => [
                            styles.whItem,
                            active ? styles.whItemActive : styles.whItemIdle,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={[styles.whItemText, active ? styles.whItemTextActive : styles.whItemTextIdle]}>
                            {Strings.home.warehouse.item(id)}
                          </Text>
                          {active ? <FontAwesome name="check" size={16} color={T.text} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}
          </Surface>

          <Surface style={styles.insight}>
            <View style={styles.insightIcon}>
              <FontAwesome name="line-chart" size={16} color={T.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.insightTitle}>{Strings.home.insight.title}</Text>
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          </Surface>

          <View style={styles.metricsGrid}>
            <MetricTile icon="cubes" title={Strings.home.metrics.totalItems} value={formatIntHR(totals?.totalItems)} tone="neutral" />
            <MetricTile icon="exclamation-circle" title={Strings.home.metrics.missing} value={formatIntHR(totals?.missingCount)} tone="warm" />
            <MetricTile icon="arrow-up" title={Strings.home.metrics.needsFill} value={formatIntHR(totals?.needsFillCount)} tone="warm" />
            <MetricTile icon="bookmark" title={Strings.home.metrics.reserved} value={formatIntHR(totals?.reservedCount)} tone="cool" />
          </View>

          <View style={{ gap: 12 }}>
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

          <View style={{ height: 18 }} />
        </ScrollView>
      </Screen>
    </AuthBackground>
  );
}

function Surface({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <View style={styles.surfaceOuter}>
      <View style={[styles.surfaceInner, style]}>{children}</View>
    </View>
  );
}

function KpiCard(props: { icon: React.ComponentProps<typeof FontAwesome>["name"]; label: string; value: string; fullWidth?: boolean }) {
  return (
    <View style={[styles.kpiCard, props.fullWidth && styles.fullWidthCard]}>
      <View style={styles.kpiIcon}>
        <FontAwesome name={props.icon} size={14} color={T.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.kpiLabel} numberOfLines={1}>
          {props.label}
        </Text>
        <Text style={styles.kpiValue} numberOfLines={1}>
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
  const iconBg =
    props.tone === "warm" ? styles.metricIconWarm : props.tone === "cool" ? styles.metricIconCool : styles.metricIconNeut;

  const accent = props.tone === "warm" ? T.warmAccent : props.tone === "cool" ? T.coolAccent : T.neutralAccent;

  return (
    <View style={[styles.metricTile, bg, { borderTopColor: accent }, props.fullWidth && styles.fullWidthCard]}>
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
  const headerTone = props.tone === "warm" ? styles.accHeaderWarm : styles.accHeaderCool;
  const iconTone = props.tone === "warm" ? styles.accIconWarm : styles.accIconCool;

  return (
    <Surface style={styles.accSurface}>
      <Pressable
        onPress={props.onPress}
        android_ripple={{ color: "rgba(2,6,23,0.10)" }}
        style={({ pressed }) => [styles.accHeader, headerTone, pressed && styles.pressed]}
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
  content: {
    paddingHorizontal: H_PADDING,
    paddingTop: 8,
    paddingBottom: 22,
    flexGrow: 1,
  },

  surfaceOuter: {
    borderRadius: 22,
    backgroundColor: "transparent",
    shadowColor: T.shadow,
    shadowOpacity: 0.10,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },

  surfaceInner: {
    borderRadius: 22,
    backgroundColor: T.surface,
    borderWidth: 1.5,
    borderColor: T.border,
    overflow: "hidden",
  },

  hero: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: T.heroBg,
    borderColor: T.heroBorder,
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  heroAccentDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: "#F97316" },
  heroBadge: { fontSize: 12, fontWeight: "900", letterSpacing: 0.6, color: T.muted },

  heroRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroTitle: { fontSize: 22, fontWeight: "900", color: T.text },
  heroSubtitle: { marginTop: 8, fontSize: 14, lineHeight: 20, color: T.subText, maxWidth: 340 },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: T.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },

  kpiWrap: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  kpiCard: {
    width: "48%",
    marginBottom: 12,
    borderRadius: 18,
    padding: 12,
    backgroundColor: T.heroCardBg,
    borderWidth: 1.5,
    borderColor: T.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  fullWidthCard: { width: "100%" },

  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: T.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiLabel: { fontSize: 12, fontWeight: "900", color: T.muted },
  kpiValue: { marginTop: 2, fontSize: 14, fontWeight: "900", color: T.text },

  whSurface: { marginBottom: 12, borderColor: T.borderStrong },

  whRow: { padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  whIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "#FFF2E8",
    borderWidth: 1.5,
    borderColor: "rgba(249,115,22,0.45)",
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

  whDropdown: { padding: 12, backgroundColor: "#FFFFFF" },
  whDropdownList: { gap: 10 },
  whDropdownLoading: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
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
    borderWidth: 1.5,
    borderColor: T.borderStrong,
    backgroundColor: "#FFFFFF",
  },
  whDropdownEmptyText: { fontSize: 14, color: T.subText, lineHeight: 20 },

  whItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: T.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  whItemIdle: { backgroundColor: "#F8FAFF" },
  whItemActive: { backgroundColor: "#FFF2E8", borderColor: "rgba(249,115,22,0.55)" },
  whItemText: { fontSize: 14, fontWeight: "900" },
  whItemTextIdle: { color: T.text },
  whItemTextActive: { color: T.text },

  pressed: { opacity: 0.97 },

  insight: {
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: "#EEF4FF",
    borderColor: T.borderStrong,
  },
  insightIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "#DCEBFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: T.borderStrong,
  },
  insightTitle: { fontSize: 14, fontWeight: "900", color: T.text },
  insightText: { marginTop: 3, fontSize: 14, color: T.subText, lineHeight: 20 },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  metricTile: {
    width: "48%",
    marginBottom: 12,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1.5,
    borderTopWidth: 6,
    borderColor: T.borderStrong,
  },
  metricNeutral: { backgroundColor: T.surface },
  metricWarm: { backgroundColor: "#FFF2E8" },
  metricCool: { backgroundColor: "#EEF4FF" },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: T.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricIconNeut: { backgroundColor: "#FFFFFF" },
  metricIconWarm: { backgroundColor: T.warmIcon },
  metricIconCool: { backgroundColor: T.coolIcon },
  metricTitle: { fontSize: 12, fontWeight: "900", color: T.muted },
  metricValue: { marginTop: 6, fontSize: 22, fontWeight: "900", color: T.text },

  accSurface: { borderColor: T.borderStrong },
  accHeader: { padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  accHeaderWarm: { backgroundColor: T.warmHeader },
  accHeaderCool: { backgroundColor: T.coolHeader },

  accIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: T.borderStrong,
  },
  accIconWarm: { backgroundColor: T.warmIcon },
  accIconCool: { backgroundColor: T.coolIcon },

  accTitle: { fontSize: 15, fontWeight: "900", color: T.text },
  accSub: { marginTop: 2, fontSize: 12, color: "rgba(15,23,42,0.84)" },

  accRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  countPill: {
    minWidth: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: T.pill,
    borderWidth: 1.5,
    borderColor: "rgba(2,6,23,0.50)",
    alignItems: "center",
    justifyContent: "center",
  },
  countPillText: { fontSize: 12, fontWeight: "900", color: T.pillText },

  accDivider: { height: 1, backgroundColor: T.divider },
  accBody: { paddingHorizontal: 14, paddingBottom: 12, paddingTop: 12, backgroundColor: "#FFFFFF" },

  listCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
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
  rowCode: { marginTop: 2, fontSize: 11, color: T.muted },

  rowRight: { alignItems: "flex-end" },
  qtyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(2,6,23,0.30)",
  },
  qtyWarm: { backgroundColor: T.warmBadge },
  qtyCool: { backgroundColor: T.coolBadge },
  qtyText: { fontSize: 11, fontWeight: "900", color: T.text },
  rowHint: { marginTop: 3, fontSize: 11, color: T.subText },

  empty: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: T.borderStrong,
  },
  emptyText: { fontSize: 14, color: T.subText, lineHeight: 20 },
});
