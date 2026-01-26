import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Colors from "@/constants/Colors";

export function CenterSheet({
  visible,
  title,
  onClose,
  children,
  width = 360,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdropWrap}>
        <Pressable style={s.backdrop} onPress={onClose} />

        <View style={s.centerWrap} pointerEvents="box-none">
          <View style={[s.card, { maxWidth: width }]}>
            <View style={s.header}>
              <Text style={s.title}>{title}</Text>

              <Pressable style={s.closeBtn} onPress={onClose} hitSlop={10}>
                <Text style={s.closeText}>Zatvori</Text>
              </Pressable>
            </View>

            <View style={s.body}>{children}</View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdropWrap: { flex: 1 },
  // manje “sivo”, više elegantno zatamnjenje
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },

  centerWrap: {
    flex: 1,
    padding: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  card: {
    width: "100%",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.10)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },

  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(2, 6, 23, 0.08)",
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.text,
  },

  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.22)",
  },
  closeText: { fontWeight: "900", color: Colors.text },

  body: {
    padding: 16,
  },
});
