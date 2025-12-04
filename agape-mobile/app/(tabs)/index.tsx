import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../../components/ui/Screen";
import SummaryCard from "../../components/dashboard/SummaryCard";
import Colors from "../../constants/Colors";

const SUMMARY_DATA = [
  {
    id: "families",
    title: "Obitelji opslužene (ovaj mjesec)",
    value: "42",
    subtitle: "+8 u odnosu na prošli mjesec",
    tone: "primary" as const,
  },
  {
    id: "items",
    title: "Artikala podijeljeno",
    value: "316",
    subtitle: "Prosjek: 7,5 artikala po obitelji",
    tone: "info" as const,
  },
  {
    id: "volunteers",
    title: "Aktivni volonteri",
    value: "12",
    subtitle: "3 prijavljena za ovaj tjedan",
    tone: "success" as const,
  },
];

const LOW_STOCK_ITEMS = [
  { id: "0001", name: "Brašno 1kg", stock: 14, target: 80 },
  { id: "0005", name: "Riža 1kg", stock: 9, target: 60 },
  { id: "0007", name: "Tjestenina 500g", stock: 18, target: 70 },
];

const HIGH_STOCK_ITEMS = [
  { id: "0025", name: "Osobna higijena", stock: 210 },
  { id: "0027", name: "Riblja konzerva", stock: 185 },
];

export default function HomeScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Dobrodošli 👋</Text>
        <Text style={styles.subtitle}>
          Pregled socijalne samoposluge za današnji dan.
        </Text>
      </View>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        {SUMMARY_DATA.map((item) => (
          <SummaryCard
            key={item.id}
            title={item.title}
            value={item.value}
            subtitle={item.subtitle}
            tone={item.tone}
          />
        ))}
      </View>

      {/* Warehouse status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stanje skladišta</Text>
        <Text style={styles.sectionSubtitle}>
          Artikli koje bi trebalo dopuniti.
        </Text>

        <View style={styles.card}>
          {LOW_STOCK_ITEMS.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.row,
                index < LOW_STOCK_ITEMS.length - 1 && styles.rowDivider,
              ]}
            >
              <View style={styles.rowText}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemCode}>Šifra: {item.id}</Text>
              </View>
              <View style={styles.stockBadgeWrapper}>
                <View style={styles.stockBadgeLow}>
                  <Text style={styles.stockBadgeText}>
                    {item.stock} / {item.target}
                  </Text>
                </View>
                <Text style={styles.stockHint}>prioritet za donacije</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Surplus items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Artikli koje imamo dovoljno</Text>
        <View style={styles.card}>
          {HIGH_STOCK_ITEMS.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.row,
                index < HIGH_STOCK_ITEMS.length - 1 && styles.rowDivider,
              ]}
            >
              <View style={styles.rowText}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemCode}>Šifra: {item.id}</Text>
              </View>
              <View style={styles.stockBadgeWrapper}>
                <View style={styles.stockBadgeHigh}>
                  <Text style={styles.stockBadgeText}>{item.stock} kom</Text>
                </View>
                <Text style={styles.stockHint}>može u iduće izdaje</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Volunteer info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Moje volontiranje</Text>
        <View style={[styles.card, styles.shiftCard]}>
          <Text style={styles.shiftLabel}>Sljedeća prijavljena smjena</Text>
          <Text style={styles.shiftValue}>Petak, 4.10. • 16:00 – 19:00</Text>
          <Text style={styles.shiftExtra}>
            Lokacija: Socijalna samoposluga, Ulica sv. Luke 7
          </Text>
          <Text style={styles.shiftExtra}>
            Zaduženje: izdavanje paketa i evidencija korisnika.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
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
  rowText: {
    flex: 1,
    paddingRight: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.light.text,
  },
  itemCode: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  stockBadgeWrapper: {
    alignItems: "flex-end",
  },
  stockBadgeLow: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FEE2E2",
  },
  stockBadgeHigh: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
  },
  stockBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  stockHint: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 3,
  },
  shiftCard: {
    marginTop: 8,
  },
  shiftLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 4,
  },
  shiftValue: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  shiftExtra: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
});
