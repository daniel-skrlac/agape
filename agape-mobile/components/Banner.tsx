import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/src/constants/Colors";

type BannerType = "info" | "error" | "success";

export function Banner({ type, text }: { type: BannerType; text: string }) {
  const { bg, fg } = useMemo(() => {
    switch (type) {
      case "error":
        return { bg: Colors.dangerBg, fg: Colors.dangerText };
      case "success":
        return { bg: Colors.successBg, fg: Colors.successText };
      case "info":
      default:
        return { bg: Colors.infoBg, fg: Colors.infoText };
    }
  }, [type]);

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
