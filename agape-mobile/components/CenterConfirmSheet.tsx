import React, { useRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Colors from "@/src/constants/Colors";
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
  const pressLockRef = useRef(false);

  const locked = !!loading || pressLockRef.current;

  const safeClose = () => {
    if (locked) return;
    onClose();
  };

  const handleConfirm = async () => {
    if (pressLockRef.current || loading) return;
    pressLockRef.current = true;
    try {
      await Promise.resolve(onConfirm());
    } finally {
      setTimeout(() => {
        pressLockRef.current = false;
      }, 250);
    }
  };

  return (
    <CenterSheet
      visible={visible}
      title={title}
      onClose={safeClose}
      closeOnBackdrop={!locked && closeOnBackdrop}
    >
      {!!description && <Text style={s.desc}>{description}</Text>}

      <View style={s.row}>
        <Pressable style={[s.btn, s.btnGhost, locked && s.btnDisabled]} onPress={safeClose} disabled={locked}>
          <Text style={s.btnGhostText}>{cancelText}</Text>
        </Pressable>

        <Pressable
          style={[s.btn, danger ? s.btnDanger : s.btnPrimary, locked && s.btnDisabled]}
          onPress={handleConfirm}
          disabled={locked}
        >
          {locked ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>{confirmText}</Text>}
        </Pressable>
      </View>
    </CenterSheet>
  );
}

const s = StyleSheet.create({
  desc: {
    marginBottom: 14,
    color: Colors.sub,
    fontWeight: "800",
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  btnDisabled: {
    opacity: 0.75,
  },
  btnGhost: {
    backgroundColor: "rgba(148,163,184,0.20)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.10)",
  },
  btnGhostText: {
    fontWeight: "900",
    color: Colors.text,
  },
  btnPrimary: {
    backgroundColor: Colors.orange,
  },
  btnDanger: {
    backgroundColor: Colors.dangerText,
  },
  btnPrimaryText: {
    fontWeight: "900",
    color: "#fff",
  },
});