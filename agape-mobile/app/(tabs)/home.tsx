import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, LayoutAnimation, Pressable, Text, useWindowDimensions, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";

import TabScroll from "@/components/ui/TabScroll";
import Strings from "../../src/constants/Strings";

import { useCurrentUser } from "../../src/api/hooks/common/useCurrentUser";
import { usePullToRefresh } from "../../src/api/hooks/common/usePullToRefresh";
import { formatQtyHR, formatTimeWithSecondsHR } from "../../src/utils/format";

import { styles, RIPPLE, T } from "../../src/styles/HomeScreen.styles";
import { ErrorCard } from "@/components/ErrorCard";

import { useWarehouses } from "../../src/api/hooks/dashboard/useWarehouses";
import { useStockStatistics } from "../../src/api/hooks/dashboard/useStockStatistics";

import { toUserMessage } from "../../src/api/apiClient";
import { documentDirectoryService } from "@/src/api/services/documentDirectoryService";
import type { DocumentDescriptorResponseDTO } from "@/src/models/generated";

type SectionKey = "missing" | "needsFill" | "most";
type FilterKey = "year" | "type" | "warehouse";

const TOP_ERR_HINT = "Greška - pogledaj poruku iznad.";
const CURRENT_YEAR = new Date().getFullYear();

export default function HomeScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();

  const { session } = useCurrentUser();
  const warehousesQuery = useWarehouses() as any;
  const warehouses: number[] = (warehousesQuery?.data ?? []) as number[];
  const whLoading: boolean = !!warehousesQuery?.isLoading;
  const whError = warehousesQuery?.error;
  const refetchWarehouses = warehousesQuery?.refetch;

  const warehousesEmpty = useMemo(
    () => !whLoading && !whError && warehouses.length === 0,
    [whLoading, whError, warehouses.length]
  );

  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [storageGroupId, setStorageGroupId] = useState<number | null>(null);
  const [documentYear, setDocumentYear] = useState<number | null>(CURRENT_YEAR);
  const [knownYears, setKnownYears] = useState<number[]>([CURRENT_YEAR]);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [openAcc, setOpenAcc] = useState<Record<SectionKey, boolean>>({
    missing: false,
    needsFill: false,
    most: false,
  });

  const docTypesQuery = useQuery({
    queryKey: ["home", "dispatch-document-types"],
    queryFn: ({ signal }) =>
      documentDirectoryService.listDocTypesByCode({ documentCode: "OTPREMNICA" }, signal),
    staleTime: 16 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  useFocusEffect(
    useCallback(() => {
      setOpenAcc({ missing: false, needsFill: false, most: false });
      setOpenFilter(null);
      return () => {
        setOpenAcc({ missing: false, needsFill: false, most: false });
        setOpenFilter(null);
      };
    }, [])
  );

  const onSelectWarehouse = useCallback((id: number | null) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setWarehouseId(id);
    setOpenFilter(null);
    setOpenAcc({ missing: false, needsFill: false, most: false });
  }, []);

  const onSelectStorageGroup = useCallback((id: number | null) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStorageGroupId(id);
    setOpenFilter(null);
    setOpenAcc({ missing: false, needsFill: false, most: false });
  }, []);

  const onSelectYear = useCallback((year: number | null) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDocumentYear(year);
    setOpenFilter(null);
    setOpenAcc({ missing: false, needsFill: false, most: false });
  }, []);

  const stats = useStockStatistics({
    warehouseId,
    storageGroupId,
    documentYear,
    documentCode: "OTPREMNICA",
  });
  const { data, isLoading, isFetching, dataUpdatedAt } = stats as any;
  const statsError = (stats as any)?.error;

  const totals = data?.totals;

  const toggleAcc = (k: SectionKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenAcc((prev) => ({ ...prev, [k]: !prev[k] }));
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

  const { refreshing, onRefresh, lastRefreshedAt } = usePullToRefresh([
    async () => {
      setOpenAcc({ missing: false, needsFill: false, most: false });
      setOpenFilter(null);

      await Promise.all([
        Promise.resolve(refetchWarehouses?.()),
        Promise.resolve(docTypesQuery.refetch?.()),
        Promise.resolve(stats.refetch?.()),
      ]);
    },
  ]);

  const visibleUpdatedAt = Math.max(Number(dataUpdatedAt ?? 0), Number(lastRefreshedAt ?? 0));
  const updatedText = useMemo(() => formatTimeWithSecondsHR(visibleUpdatedAt), [visibleUpdatedAt]);

  const missingItems = data?.missing ?? [];
  const needsFillItems = data?.needsFill ?? [];
  const mostItems = data?.mostInStock ?? [];

  const categories = useMemo(() => {
    const map = new Map<number, string>();
    for (const doc of ((docTypesQuery.data ?? []) as DocumentDescriptorResponseDTO[])) {
      const id = Number((doc as any)?.storageGroupId);
      if (!Number.isFinite(id) || id <= 0) continue;
      const name = String((doc as any)?.storageGroupName ?? "").trim() || `Grupa dokumenta ${id}`;
      map.set(id, name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [docTypesQuery.data]);

  useEffect(() => {
    const incoming = (((data as any)?.availableYears ?? []) as any[])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 1990);

    setKnownYears((prev) => {
      const next = Array.from(new Set([CURRENT_YEAR, ...prev, ...incoming])).sort((a, b) => b - a);
      if (next.length === prev.length && next.every((value, index) => value === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [data]);

  const yearOptions = useMemo(() => {
    const set = new Set<number>();
    set.add(CURRENT_YEAR);
    for (const y of knownYears) {
      if (Number.isFinite(y) && y > 1990) set.add(y);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [knownYears]);

  const selectedCategoryLabel = useMemo(() => {
    if (storageGroupId == null) return "Sve grupe";
    return categories.find((cat) => cat.id === storageGroupId)?.name ?? `Grupa dokumenta ${storageGroupId}`;
  }, [categories, storageGroupId]);

  const selectedWarehouseLabel = warehouseId == null ? "Sva skladišta" : `Skladište #${warehouseId}`;
  const selectedYearLabel = documentYear == null ? "Sve godine" : String(documentYear);

  const statsRefreshingInline = isFetching && !refreshing;

  const whErrorMessage = useMemo(() => (whError ? toUserMessage(whError) : null), [whError]);

  const docTypesErrorMessage = useMemo(
    () => (docTypesQuery.error ? toUserMessage(docTypesQuery.error) : null),
    [docTypesQuery.error]
  );

  const statsErrorMessage = useMemo(() => {
    if (!statsError) return null;
    return toUserMessage(statsError);
  }, [statsError]);

  const topError = useMemo(
    () => whErrorMessage || docTypesErrorMessage || statsErrorMessage,
    [whErrorMessage, docTypesErrorMessage, statsErrorMessage]
  );
  const topErrorTitle = whErrorMessage
    ? "Ne mogu učitati skladišta"
    : docTypesErrorMessage
      ? "Ne mogu učitati vrste"
      : "Ne mogu učitati statistiku";
  const expandTopItems =
    windowHeight >= 850 && !warehousesEmpty && openFilter == null && !openAcc.missing && !openAcc.needsFill && !openAcc.most;

  const onTopErrorAction = useCallback(() => {
    if (whErrorMessage) return refetchWarehouses?.();
    if (docTypesErrorMessage) return docTypesQuery.refetch?.();
    return stats.refetch?.();
  }, [whErrorMessage, docTypesErrorMessage, refetchWarehouses, docTypesQuery, stats]);

  return (
    <TabScroll
      style={styles.scroll}
      refreshing={refreshing}
      onRefresh={onRefresh}
      contentContainerStyle={styles.content}
      overScrollMode="always"
      alwaysBounceVertical
      bounces
    >
      <View style={styles.screenInner}>
        <View style={styles.sectionGap}>
          <HeroCard
            routerPushProfile={() => router.push("/profile")}
            displayName={displayName}
            headerSubtitle={headerSubtitle}
            totalsQty={formatQtyHR(totals?.totalStockQty)}
            updatedText={updatedText}
            expanded={expandTopItems}
          />
        </View>

        {!!topError ? (
          <View style={styles.sectionGap}>
            <ErrorCard
              title={topErrorTitle}
              message={topError}
              actionText="Pokušaj ponovno"
              onAction={onTopErrorAction}
              messageLines={2}
              titleLines={1}
            />
          </View>
        ) : null}

        <View style={styles.sectionGap}>
          <LinearGradient
            colors={["rgba(255,255,255,0.98)", "rgba(255,247,237,0.92)", "rgba(255,255,255,0.96)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.filterBar, expandTopItems && styles.filterBarExpanded]}
          >
            <View style={[styles.filterTopLine, expandTopItems && styles.filterTopLineExpanded]}>
              <View style={styles.filterTitleRow}>
                <View style={styles.filterMiniIcon}>
                  <FontAwesome name="sliders" size={13} color={T.text} />
                </View>
                <Text style={styles.filterTitle}>Pregled zaliha</Text>
              </View>
              {statsRefreshingInline ? <ActivityIndicator size="small" color={T.warmAccent} /> : null}
            </View>

            <View style={[styles.filterSelectRow, expandTopItems && styles.filterSelectRowExpanded]}>
              <FilterSelect
                label="Godina"
                value={selectedYearLabel}
                icon="calendar"
                open={openFilter === "year"}
                expanded={expandTopItems}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setOpenFilter((value) => (value === "year" ? null : "year"));
                }}
              />
              <FilterSelect
                label="Grupa"
                value={selectedCategoryLabel}
                icon="tag"
                open={openFilter === "type"}
                expanded={expandTopItems}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setOpenFilter((value) => (value === "type" ? null : "type"));
                }}
              />
              <FilterSelect
                label="Skladište"
                value={selectedWarehouseLabel}
                icon="archive"
                open={openFilter === "warehouse"}
                expanded={expandTopItems}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setOpenFilter((value) => (value === "warehouse" ? null : "warehouse"));
                }}
              />
            </View>

            <View style={styles.filterSummary}>
              <Text style={styles.filterSummaryLabel}>Odabrani filter</Text>
              <Text style={styles.filterSummaryText}>
                Grupa: {selectedCategoryLabel} • Godina: {selectedYearLabel} • {selectedWarehouseLabel}
              </Text>
            </View>

            {openFilter === "year" ? (
              <FilterDropdown>
                <DropdownOption label="Sve godine" active={documentYear == null} onPress={() => onSelectYear(null)} />
                {yearOptions.map((year) => (
                  <DropdownOption
                    key={year}
                    label={String(year)}
                    active={documentYear === year}
                    onPress={() => onSelectYear(year)}
                  />
                ))}
              </FilterDropdown>
            ) : null}

            {openFilter === "type" ? (
              <FilterDropdown>
                <DropdownOption label="Sve vrste" active={storageGroupId == null} onPress={() => onSelectStorageGroup(null)} />
                {categories.map((cat) => (
                  <DropdownOption
                    key={cat.id}
                    label={cat.name}
                    active={storageGroupId === cat.id}
                    onPress={() => onSelectStorageGroup(cat.id)}
                  />
                ))}
              </FilterDropdown>
            ) : null}

            {openFilter === "warehouse" ? (
              <FilterDropdown>
                <DropdownOption label="Sva skladišta" active={warehouseId == null} onPress={() => onSelectWarehouse(null)} />
                {warehouses.map((id) => (
                  <DropdownOption
                    key={id}
                    label={`Skladište #${id}`}
                    active={warehouseId === id}
                    onPress={() => onSelectWarehouse(id)}
                  />
                ))}
              </FilterDropdown>
            ) : null}
          </LinearGradient>
        </View>

        {warehousesEmpty ? (
          <View style={styles.sectionGap}>
            <EmptyLine text={Strings.home.warehouse.empty} />
          </View>
        ) : null}

        {!warehousesEmpty ? (
          <>
            <View style={styles.sectionGap}>
              <StatusRail
                items={[
                  {
                    icon: "cubes",
                    label: Strings.home.metrics.totalItems,
                    value: formatQtyHR(totals?.totalItems),
                    tone: "neutral",
                  },
                  {
                    icon: "exclamation-circle",
                    label: Strings.home.metrics.missing,
                    value: formatQtyHR(totals?.missingCount),
                    tone: "warm",
                  },
                  {
                    icon: "arrow-up",
                    label: Strings.home.metrics.needsFill,
                    value: formatQtyHR(totals?.needsFillCount),
                    tone: "warm",
                  },
                ]}
                expanded={expandTopItems}
              />
            </View>

            <View style={styles.sectionGapStack}>
              <Accordion
                icon="exclamation-circle"
                tone="warm"
                title={Strings.home.sections.missingTitle}
                subtitle={Strings.home.sections.missingSub}
                count={totals?.missingCount ?? 0}
                open={openAcc.missing}
                onPress={() => toggleAcc("missing")}
              >
                {isLoading ? (
                  <EmptyLine text={Strings.home.empty.loading} />
                ) : topError ? (
                  <EmptyLine text={TOP_ERR_HINT} />
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
                count={totals?.needsFillCount ?? 0}
                open={openAcc.needsFill}
                onPress={() => toggleAcc("needsFill")}
              >
                {isLoading ? (
                  <EmptyLine text={Strings.home.empty.loading} />
                ) : topError ? (
                  <EmptyLine text={TOP_ERR_HINT} />
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
                open={openAcc.most}
                onPress={() => toggleAcc("most")}
              >
                {isLoading ? (
                  <EmptyLine text={Strings.home.empty.loading} />
                ) : topError ? (
                  <EmptyLine text={TOP_ERR_HINT} />
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
          </>
        ) : null}

      </View>
    </TabScroll>
  );
}

function Surface({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

function HeroCard(props: {
  routerPushProfile: () => void;
  displayName: string;
  headerSubtitle: string;
  totalsQty: string;
  updatedText: string;
  expanded?: boolean;
}) {
  return (
    <View style={styles.heroWrap}>
      <LinearGradient
        colors={["#FFF1E7", "#FFFFFF", "#EEF4FF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroBgCard, props.expanded && styles.heroBgCardExpanded]}
      >
        <View pointerEvents="none" style={styles.heroAccentRail} />
        <View style={[styles.heroTopRow, props.expanded && styles.heroTopRowExpanded]}>
          <View style={styles.heroAccentDot} />
          <Text style={styles.heroBadge}>{Strings.home.hero.eyebrow}</Text>
        </View>

        <View style={styles.heroRow}>
          <View style={styles.flex1}>
            <Text style={[styles.heroTitle, props.expanded && styles.heroTitleExpanded]} numberOfLines={1}>
              {Strings.home.hero.title(props.displayName)}
            </Text>
            <Text style={[styles.heroSubtitle, props.expanded && styles.heroSubtitleExpanded]}>{props.headerSubtitle}</Text>
          </View>

          <Pressable onPress={props.routerPushProfile} style={[styles.avatar, props.expanded && styles.avatarExpanded]}>
            <FontAwesome name="user" size={props.expanded ? 20 : 18} color={T.text} />
          </Pressable>
        </View>

        <View style={[styles.kpiRow, props.expanded && styles.kpiRowExpanded]}>
          <KpiChip icon="archive" label={Strings.home.meta.totalQty} value={props.totalsQty} expanded={props.expanded} />
          <KpiChip icon="clock-o" label={Strings.home.meta.updatedAt} value={props.updatedText} expanded={props.expanded} />
        </View>
      </LinearGradient>
    </View>
  );
}

function KpiChip(props: { icon: React.ComponentProps<typeof FontAwesome>["name"]; label: string; value: string; expanded?: boolean }) {
  return (
    <View style={[styles.kpiChip, props.expanded && styles.kpiChipExpanded]}>
      <View style={[styles.kpiChipIcon, props.expanded && styles.kpiChipIconExpanded]}>
        <FontAwesome name={props.icon} size={props.expanded ? 15 : 14} color={T.text} />
      </View>
      <View style={styles.flex1}>
        <Text style={[styles.kpiChipLabel, props.expanded && styles.kpiChipLabelExpanded]} numberOfLines={1}>
          {props.label}
        </Text>
        <Text style={[styles.kpiChipValue, props.expanded && styles.kpiChipValueExpanded]} numberOfLines={1}>
          {props.value}
        </Text>
      </View>
    </View>
  );
}

function StatusRail(props: {
  items: Array<{
    icon: React.ComponentProps<typeof FontAwesome>["name"];
    label: string;
    value: string;
    tone: "neutral" | "warm" | "cool";
  }>;
  expanded?: boolean;
}) {
  return (
    <LinearGradient
      colors={["rgba(255,255,255,0.98)", "rgba(248,250,252,0.94)", "rgba(255,247,237,0.80)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.statusRail, props.expanded && styles.statusRailExpanded]}
    >
      {props.items.map((item, index) => {
        const toneStyle =
          item.tone === "warm" ? styles.statusIconWarm : item.tone === "cool" ? styles.statusIconCool : styles.statusIconNeutral;
        return (
          <View key={`${item.label}-${index}`} style={[styles.statusItem, props.expanded && styles.statusItemExpanded]}>
            <View style={[styles.statusIcon, toneStyle, props.expanded && styles.statusIconExpanded]}>
              <FontAwesome name={item.icon} size={props.expanded ? 15 : 13} color={T.text} />
            </View>
            <View style={styles.flex1}>
              <Text style={[styles.statusValue, props.expanded && styles.statusValueExpanded]} numberOfLines={1}>{item.value}</Text>
              <Text style={[styles.statusLabel, props.expanded && styles.statusLabelExpanded]} numberOfLines={1}>{item.label}</Text>
            </View>
            {index < props.items.length - 1 ? <View style={styles.statusDivider} /> : null}
          </View>
        );
      })}
    </LinearGradient>
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
  const headerColors =
    props.tone === "warm"
      ? (["rgba(255,255,255,0.98)", "rgba(255,247,237,0.88)"] as const)
      : (["rgba(255,255,255,0.98)", "rgba(239,246,255,0.88)"] as const);

  return (
    <Surface style={styles.accSurface}>
      <LinearGradient
        colors={headerColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.accHeaderGradient}
      >
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
              <Text style={styles.countPillText}>{formatQtyHR(props.count)}</Text>
            </View>
            <FontAwesome name={props.open ? "chevron-up" : "chevron-down"} size={16} color={T.muted} />
          </View>
        </Pressable>
      </LinearGradient>

      <View style={[styles.accDivider, { height: 1 }]} />

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

function FilterSelect(props: {
  label: string;
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  value: string;
  open: boolean;
  expanded?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.filterSelect,
        props.open && styles.filterSelectOpen,
        props.expanded && styles.filterSelectExpanded,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.filterSelectIcon, props.open && styles.filterSelectIconOpen]}>
        <FontAwesome name={props.icon} size={13} color={T.text} />
      </View>
      <View style={styles.flex1}>
        <Text style={[styles.filterSelectLabel, props.open && styles.filterSelectLabelOpen, props.expanded && styles.filterSelectLabelExpanded]} numberOfLines={1}>
          {props.label}
        </Text>
        <Text style={[styles.filterSelectValue, props.expanded && styles.filterSelectValueExpanded]} numberOfLines={1}>
          {props.value}
        </Text>
      </View>
      <FontAwesome name={props.open ? "chevron-up" : "chevron-down"} size={12} color={T.muted} />
    </Pressable>
  );
}

function FilterDropdown({ children }: { children: React.ReactNode }) {
  return <View style={styles.filterDropdown}>{children}</View>;
}

function DropdownOption(props: { label: string; active: boolean; onPress: () => void }) {
  return (
    <View style={styles.dropdownOptionWrap}>
      <Pressable
        onPress={props.onPress}
        style={({ pressed }) => [
          styles.dropdownOption,
          props.active && styles.dropdownOptionActive,
          pressed && styles.dropdownOptionPressed,
        ]}
      >
        <Text style={[styles.dropdownOptionText, props.active && styles.dropdownOptionTextActive]} numberOfLines={2}>
          {props.label}
        </Text>
        {props.active ? (
          <View style={styles.dropdownCheckPill}>
            <FontAwesome name="check" size={12} color={T.text} />
          </View>
        ) : (
          <View style={styles.dropdownCheckGhost} />
        )}
      </Pressable>
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
