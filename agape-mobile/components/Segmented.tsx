import Colors from "@/constants/Colors";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.wrap}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.item, on && s.on]}>
            <Text style={[s.text, on && s.textOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: "row", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border, overflow: "hidden", backgroundColor: Colors.bg
  },
  item: { flex: 1, paddingVertical: 10, alignItems: "center" },
  on: { backgroundColor: "rgba(249,115,22,0.12)" },
  text: { fontWeight: "900", color: Colors.sub },
  textOn: { color: Colors.text },
});
