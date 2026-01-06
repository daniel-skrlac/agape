import React, { useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import Screen from "../../components/ui/Screen";
import SummaryCard from "../../components/dashboard/SummaryCard";
import Colors from "../../constants/Colors";
import Strings from "../../constants/Strings";
import { useStockStatistics } from "../api/hooks/useStockStatistics";

function formatInt(n?: number) {
  const value = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("hr-HR", { maximumFractionDigits: 0 }).format(value);
}

function formatQty(n?: number) {
  const value = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("hr-HR", { maximumFractionDigits: 2 }).format(value);
}

function formatTime(ts?: number) {
  if (!ts) return "—";
  const d = new Date(ts);
  return new Intl.DateTimeFormat("hr-HR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function HomeScreen() {
  const { data, isLoading, error, refetch, isRefetching, dataUpdatedAt } =
    useStockStatistics();

  const summary = useMemo(() => {
    const t = data?.totals;
    return [
      {
        id: "totalItems",
        title: Strings.home.totals.totalItemsTitle,
        value: formatInt(t?.totalItems),
        subtitle: Strings.home.totals.totalItemsSub,
        tone: "primary" as const,
      },
      {
        id: "missing",
        title: Strings.home.totals.missingTitle,
        value: formatInt(t?.missingCount),
        subtitle: Strings.home.totals.missingSub,
        tone: "info" as const,
      },
      {
        id: "needsFill",
        title: Strings.home.totals.needsFillTitle,
        value: formatInt(t?.needsFillCount),
        subtitle: Strings.home.totals.needsFillSub,
        tone: "success" as const,
      },
      {
        id: "reserved",
        title: Strings.home.totals.reservedTitle,
        value: formatInt(t?.reservedCount),
        subtitle: Strings.home.totals.reservedSub,
        tone: "primary" as const,
      },
    ];
  }, [data]);

  const statusText = useMemo(() => {
    if (isLoading || isRefetching) return Strings.home.status.loading;
    if (error) return Strings.home.status.offline;
    return Strings.home.status.ready;
  }, [isLoading, isRefetching, error]);

  return (
    <Screen>
      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HERO (warm + professional) */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{Strings.home.title}</Text>
          <Text style={styles.heroSubtitle}>{Strings.home.subtitle}</Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.statusPill}>
              {(isLoading || isRefetching) ? (
                <ActivityIndicator size="small" color="#111827" />
              ) : (
                <View style={[styles.statusDot, error ? styles.statusDotWarn : styles.statusDotOk]} />
              )}
              <Text style={styles.statusText}>{statusText}</Text>
            </View>

            <View style={styles.metaPill}>
              <Text style={styles.metaLabel}>{Strings.home.totals.totalStockQty}</Text>
              <Text style={styles.metaValue}>{formatQty(data?.totals.totalStockQty)}</Text>
            </View>

            <View style={styles.metaPill}>
              <Text style={styles.metaLabel}>{Strings.home.totals.updatedAt}</Text>
              <Text style={styles.metaValue}>{formatTime(dataUpdatedAt)}</Text>
            </View>
          </View>
        </View>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          {summary.map((item) => (
            <SummaryCard
              key={item.id}
              title={item.title}
              value={item.value}
              subtitle={item.subtitle}
              tone={item.tone}
            />
          ))}
        </View>

        {/* Needs fill */}
        <Section
          title={Strings.home.sections.needsFillTitle}
          subtitle={Strings.home.sections.needsFillSub}
          badgeText={formatInt(data?.needsFill?.length)}
        >
          <View style={styles.card}>
            {(data?.needsFill ?? []).slice(0, 10).map((item, index, arr) => (
              <Row
                key={`${item.itemId}-${item.warehouseId}`}
                name={item.name}
                code={item.itemCode}
                hint={Strings.home.rowHints.needsFill}
                badge={`${formatQty(item.currentQty)} / ${formatQty(item.minimalQty)}`}
                badgeStyle="low"
                showDivider={index < arr.length - 1}
              />
            ))}
            {!isLoading && (data?.needsFill?.length ?? 0) === 0 && (
              <EmptyLine text={Strings.home.empty.needsFill} />
            )}
            {isLoading && <EmptyLine text={Strings.home.empty.loading} />}
          </View>
        </Section>

        {/* Missing */}
        <Section
          title={Strings.home.sections.missingTitle}
          subtitle={Strings.home.sections.missingSub}
          badgeText={formatInt(data?.missing?.length)}
        >
          <View style={styles.card}>
            {(data?.missing ?? []).slice(0, 10).map((item, index, arr) => (
              <Row
                key={`${item.itemId}-${item.warehouseId}`}
                name={item.name}
                code={item.itemCode}
                hint={Strings.home.rowHints.missing}
                badge={`${formatQty(item.currentQty)} kom`}
                badgeStyle="warn"
                showDivider={index < arr.length - 1}
              />
            ))}
            {!isLoading && (data?.missing?.length ?? 0) === 0 && (
              <EmptyLine text={Strings.home.empty.missing} />
            )}
            {isLoading && <EmptyLine text={Strings.home.empty.loading} />}
          </View>
        </Section>

        {/* Most in stock */}
        <Section
          title={Strings.home.sections.mostTitle}
          subtitle={Strings.home.sections.mostSub}
          badgeText={formatInt(data?.mostInStock?.length)}
        >
          <View style={styles.card}>
            {(data?.mostInStock ?? []).slice(0, 10).map((item, index, arr) => (
              <Row
                key={`${item.itemId}-${item.warehouseId}`}
                name={item.name}
                code={item.itemCode}
                hint={Strings.home.rowHints.most}
                badge={`${formatQty(item.currentQty)} kom`}
                badgeStyle="high"
                showDivider={index < arr.length - 1}
              />
            ))}
            {!isLoading && (data?.mostInStock?.length ?? 0) === 0 && (
              <EmptyLine text={Strings.home.empty.most} />
            )}
            {isLoading && <EmptyLine text={Strings.home.empty.loading} />}
          </View>
        </Section>

        <View style={{ height: 16 }} />
      </ScrollView>
    </Screen>
  );
}

function Section(props: {
  title: string;
  subtitle?: string;
  badgeText?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{props.title}</Text>
          {!!props.subtitle && <Text style={styles.sectionSubtitle}>{props.subtitle}</Text>}
        </View>
        {!!props.badgeText && (
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{props.badgeText}</Text>
          </View>
        )}
      </View>
      {props.children}
    </View>
  );
}

function Row(props: {
  name: string;
  code: string;
  badge: string;
  hint: string;
  badgeStyle: "low" | "high" | "warn";
  showDivider?: boolean;
}) {
  const badgeStyle =
    props.badgeStyle === "low"
      ? styles.stockBadgeLow
      : props.badgeStyle === "warn"
        ? styles.stockBadgeWarn
        : styles.stockBadgeHigh;

  return (
    <View style={[styles.row, props.showDivider && styles.rowDivider]}>
      <View style={styles.rowText}>
        <Text style={styles.itemName} numberOfLines={1}>
          {props.name}
        </Text>
        <Text style={styles.itemCode}>Šifra: {props.code}</Text>
      </View>
      <View style={styles.stockBadgeWrapper}>
        <View style={badgeStyle}>
          <Text style={styles.stockBadgeText}>{props.badge}</Text>
        </View>
        <Text style={styles.stockHint}>{props.hint}</Text>
      </View>
    </View>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <View style={styles.emptyLine}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 24 },

  // HERO
  hero: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    backgroundColor: "#111827",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.78)",
    lineHeight: 18,
  },
  heroMetaRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  statusDot: { width: 8, height: 8, borderRadius: 99 },
  statusDotOk: { backgroundColor: "#10B981" },
  statusDotWarn: { backgroundColor: "#F59E0B" },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
  },

  metaPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  metaLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.70)",
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },

  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.light.text,
    marginBottom: 2,
  },
  sectionSubtitle: { fontSize: 13, color: "#6B7280" },
  sectionBadge: {
    minWidth: 34,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionBadgeText: { fontSize: 12, fontWeight: "900", color: "#111827" },

  card: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  rowText: { flex: 1, paddingRight: 12 },
  itemName: { fontSize: 14, fontWeight: "700", color: Colors.light.text },
  itemCode: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  stockBadgeWrapper: { alignItems: "flex-end" },
  stockBadgeLow: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FEE2E2",
  },
  stockBadgeWarn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
  },
  stockBadgeHigh: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
  },
  stockBadgeText: { fontSize: 12, fontWeight: "900", color: "#111827" },
  stockHint: { fontSize: 11, color: "#9CA3AF", marginTop: 3 },

  emptyLine: { paddingVertical: 14 },
  emptyText: { fontSize: 13, color: "#6B7280" },
});
