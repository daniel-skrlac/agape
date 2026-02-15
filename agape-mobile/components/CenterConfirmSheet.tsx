import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/Colors";
import { CenterSheet } from "@/components/CenterSheet";

export function CenterConfirmSheet({
  visible,
  title,
  description,
  confirmText,
  cancelText = "Odustani",
  danger,
  loading,
  onClose,
  onConfirm,
  closeOnBackdrop = true,
}: {
  visible: boolean;
  title: string;
  description?: string | null;
  confirmText: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  closeOnBackdrop?: boolean;
}) {
  return (
    <CenterSheet
      visible={visible}
      title={title}
      onClose={onClose}
      closeOnBackdrop={closeOnBackdrop}
    >
      {!!description && <Text style={s.desc}>{description}</Text>}

      <View style={s.row}>
        <Pressable style={[s.btn, s.btnGhost]} onPress={onClose} disabled={!!loading}>
          <Text style={s.btnGhostText}>{cancelText}</Text>
        </Pressable>

        <Pressable
          style={[s.btn, danger ? s.btnDanger : s.btnPrimary, loading && { opacity: 0.7 }]}
          onPress={onConfirm}
          disabled={!!loading}
        >
          <Text style={s.btnPrimaryText}>{loading ? "Učitavam…" : confirmText}</Text>
        </Pressable>
      </View>
    </CenterSheet>
  );
}

const s = StyleSheet.create({
  desc: { marginBottom: 14, color: Colors.sub, fontWeight: "800" },
  row: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnGhost: {
    backgroundColor: "rgba(148,163,184,0.20)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.10)",
  },
  btnGhostText: { fontWeight: "900", color: Colors.text },
  btnPrimary: { backgroundColor: Colors.orange },
  btnDanger: { backgroundColor: Colors.dangerText },
  btnPrimaryText: { fontWeight: "900", color: "#fff" },
});
