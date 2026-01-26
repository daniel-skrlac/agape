import Colors from "@/constants/Colors";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function Banner({ type, text }: { type: "info" | "error" | "success"; text: string }) {
  const bg =
    type === "error" ? Colors.dangerBg : type === "success" ? "rgba(34,197,94,0.12)" : "rgba(59,130,246,0.10)";
  const fg =
    type === "error" ? Colors.dangerText : type === "success" ? "#166534" : Colors.sharedText;

  return (
    <View style={[s.wrap, { backgroundColor: bg, borderColor: Colors.border }]}>
      <Text style={[s.text, { color: fg }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  text: { fontWeight: "800" },
});
