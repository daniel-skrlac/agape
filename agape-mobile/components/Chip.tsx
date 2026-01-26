import Colors from "@/constants/Colors";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

export function Chip({ label, active, onPress, onLongPress }: { label: string; active?: boolean; onPress: () => void; onLongPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[s.chip, active ? s.on : s.off]}
    >
      <Text style={[s.text, active ? s.textOn : s.textOff]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, maxWidth: 180 },
  on: { backgroundColor: "rgba(249,115,22,0.12)", borderColor: "rgba(249,115,22,0.45)" },
  off: { backgroundColor: Colors.bg, borderColor: Colors.border },
  text: { fontWeight: "900" },
  textOn: { color: Colors.text },
  textOff: { color: Colors.sub },
});
