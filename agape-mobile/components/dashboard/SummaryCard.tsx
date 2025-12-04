import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "../../constants/Colors";

type Tone = "primary" | "info" | "success";

interface Props {
  title: string;
  value: string;
  subtitle?: string;
  tone?: Tone;
}

const toneBackground: Record<Tone, string> = {
  primary: "#FFF1E7",
  info: "#E0F2FE",
  success: "#DCFCE7",
};

const toneText: Record<Tone, string> = {
  primary: Colors.tintColor,
  info: "#0284C7",
  success: "#15803D",
};

const SummaryCard: React.FC<Props> = ({
  title,
  value,
  subtitle,
  tone = "primary",
}) => {
  return (
    <View style={[styles.card, { backgroundColor: toneBackground[tone] }]}>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.value, { color: toneText[tone] }]}>{value}</Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexBasis: "48%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  title: {
    fontSize: 12,
    color: "#4B5563",
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: "#6B7280",
  },
});

export default SummaryCard;
