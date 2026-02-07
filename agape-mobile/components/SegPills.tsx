import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/Colors";

type Opt<T extends string> = { key: T; label: string };

export function SegPills<T extends string>(props: {
  value: T;
  onChange: (v: T) => void;
  options: Opt<T>[];
}) {
  const { value, onChange, options } = props;

  return (
    <View style={s.wrap}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            style={[s.pill, active && s.pillActive]}
            onPress={() => onChange(o.key)}
          >
            <Text style={[s.txt, active && s.txtActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: "rgba(148,163,184,0.12)",
  },
  pillActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  txt: { fontWeight: "900", color: Colors.text, fontSize: 12 },
  txtActive: { color: "#fff" },
});
