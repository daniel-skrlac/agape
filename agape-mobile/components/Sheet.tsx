import Colors from "@/src/constants/Colors";
import React, { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

//TODO: DEPRECATED
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.header}>
          <Text style={s.title}>{title}</Text>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeText}>Zatvori</Text>
          </Pressable>
        </View>
        <View style={{ gap: 10 }}>{children}</View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    padding: 14,
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  title: { fontSize: 16, fontWeight: "900", color: Colors.text },
  closeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "rgba(148,163,184,0.18)" },
  closeText: { fontWeight: "900", color: Colors.text },
});
