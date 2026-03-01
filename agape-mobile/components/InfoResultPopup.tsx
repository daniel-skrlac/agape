import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import Colors from "@/src/constants/Colors";
import { CenterSheet } from "@/components/CenterSheet";

type Variant = "success" | "error" | "info";

type Props = {
  visible: boolean;
  variant?: Variant;
  title: string;
  message: string;
  buttonText?: string;
  subtitle?: string;

  linkText?: string;
  onLinkPress?: () => void;

  onClose: () => void;
  closeOnBackdrop?: boolean;
};

function paletteOf(variant: Variant) {
  if (variant === "success") {
    return {
      icon: "check-circle",
      iconColor: Colors.successText ?? "#166534",
      iconBg: "rgba(34,197,94,0.14)",
      iconBd: "rgba(34,197,94,0.26)",

      chipBg: "rgba(34,197,94,0.10)",
      chipBd: "rgba(34,197,94,0.22)",
      chipText: Colors.successText ?? Colors.text,

      panelBg: "rgba(34,197,94,0.06)",
      panelBd: "rgba(34,197,94,0.18)",

      btnBg: Colors.successBg ?? "rgba(34,197,94,0.12)",
      btnBd: Colors.status?.okBd ?? "rgba(34,197,94,0.28)",
      btnText: Colors.successText ?? Colors.text,
    } as const;
  }

  if (variant === "error") {
    return {
      icon: "times-circle",
      iconColor: Colors.dangerText ?? "#7F1D1D",
      iconBg: "rgba(239,68,68,0.14)",
      iconBd: "rgba(239,68,68,0.26)",

      chipBg: "rgba(239,68,68,0.10)",
      chipBd: "rgba(239,68,68,0.22)",
      chipText: Colors.dangerText ?? Colors.text,

      panelBg: "rgba(239,68,68,0.05)",
      panelBd: "rgba(239,68,68,0.18)",

      btnBg: Colors.dangerBg ?? "rgba(239,68,68,0.12)",
      btnBd: Colors.status?.badBd ?? "rgba(239,68,68,0.28)",
      btnText: Colors.dangerText ?? Colors.text,
    } as const;
  }

  return {
    icon: "info-circle",
    iconColor: Colors.infoText ?? "#1D4ED8",
    iconBg: "rgba(59,130,246,0.14)",
    iconBd: "rgba(59,130,246,0.26)",

    chipBg: "rgba(59,130,246,0.10)",
    chipBd: "rgba(59,130,246,0.22)",
    chipText: Colors.infoText ?? Colors.text,

    panelBg: "rgba(59,130,246,0.05)",
    panelBd: "rgba(59,130,246,0.18)",

    btnBg: Colors.infoBg ?? "rgba(59,130,246,0.12)",
    btnBd: "rgba(59,130,246,0.28)",
    btnText: Colors.infoText ?? Colors.text,
  } as const;
}

export function InfoResultPopup({
  visible,
  variant = "info",
  title,
  message,
  buttonText = "U redu",
  subtitle,
  linkText,
  onLinkPress,
  onClose,
  closeOnBackdrop = true,
}: Props) {
  const p = paletteOf(variant);

  return (
    <CenterSheet visible={visible} title={title} onClose={onClose} closeOnBackdrop={closeOnBackdrop}>
      <View style={s.wrap}>
        <View style={s.headerRow}>
          <View style={[s.iconWrap, { backgroundColor: p.iconBg, borderColor: p.iconBd }]}>
            <FontAwesome name={p.icon as any} size={18} color={p.iconColor} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={s.titleText}>{title}</Text>

            {!!(subtitle ?? "").trim() && (
              <View style={[s.chip, { backgroundColor: p.chipBg, borderColor: p.chipBd }]}>
                <Text style={[s.chipText, { color: p.chipText }]} numberOfLines={2}>
                  {subtitle}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={[s.messagePanel, { backgroundColor: p.panelBg, borderColor: p.panelBd }]}>
          <Text style={s.messageText}>{message}</Text>
        </View>

        {!!onLinkPress && !!(linkText ?? "").trim() && (
          <Pressable onPress={onLinkPress} style={s.linkBtn} hitSlop={6}>
            <FontAwesome name="external-link" size={13} color={Colors.infoText ?? Colors.text} />
            <Text style={s.linkText}>{linkText}</Text>
          </Pressable>
        )}

        <Pressable
          onPress={onClose}
          style={[s.btn, { backgroundColor: p.btnBg, borderColor: p.btnBd }]}
          hitSlop={4}
        >
          <Text style={[s.btnText, { color: p.btnText }]}>{buttonText}</Text>
        </Pressable>
      </View>
    </CenterSheet>
  );
}

const s = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  titleText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 1,
  },
  chip: {
    marginTop: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: "100%",
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  messagePanel: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  messageText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },

  linkBtn: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border ?? "rgba(148,163,184,0.35)",
    backgroundColor: Colors.neutralBgSoft ?? "rgba(148,163,184,0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  linkText: {
    color: Colors.infoText ?? Colors.text,
    fontSize: 13,
    fontWeight: "700",
  },

  btn: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  btnText: {
    fontWeight: "800",
    fontSize: 14,
  },
});

export default InfoResultPopup;