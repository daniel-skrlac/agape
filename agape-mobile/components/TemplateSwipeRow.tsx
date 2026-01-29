import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";

import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import Colors from "@/constants/Colors";
import type { TemplateResponseDTO, DispatchTemplateSharePermission } from "@/app/models/generated";
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";


type TemplateRow = TemplateResponseDTO & {
  /**
   * ✅ DODAJ ovo na backend i regeneriraj types:
   * sharedPermission?: DispatchTemplateSharePermission | null
   */
  sharedPermission?: DispatchTemplateSharePermission | null;
};

function canEditDeleteTemplate(t: TemplateRow) {
  // nije shared => owner => može
  if (!t.shared) return true;

  // shared => samo BOOK može edit/delete (po tvom zahtjevu)
  return t.sharedPermission === "BOOK";
}

function RightActionButton({
  label,
  icon,
  danger,
  onPress,
  progress,
  index,
}: {
  label: string;
  icon: any;
  danger?: boolean;
  onPress: () => void;
  progress: SharedValue<number>;
  index: number;
}) {
  const anim = useAnimatedStyle(() => {
    const s = interpolate(progress.value, [0, 1], [0.9, 1]);
    const o = interpolate(progress.value, [0, 1], [0, 1]);
    return { transform: [{ scale: s }], opacity: o };
  }, []);

  return (
    <Animated.View style={[sw.actionWrap, anim, index > 0 ? { marginLeft: 10 } : null]}>
      <Pressable style={[sw.actionBtn, danger ? sw.dangerBtn : sw.neutralBtn]} onPress={onPress}>
        <FontAwesome name={icon} size={16} color={danger ? Colors.dangerText : Colors.text} />
        <Text style={[sw.actionText, danger ? { color: Colors.dangerText } : null]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function TemplateSwipeRow({
  item,
  onEdit,
  onDelete,
}: {
  item: TemplateRow;
  onEdit: (id: number) => void;
  onDelete: (id: number, name: string) => void;
}) {
  const allowEditDelete = canEditDeleteTemplate(item);

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={(progress) => (
        <View style={sw.actions}>
          {allowEditDelete ? (
            <>
              <RightActionButton
                label="Uredi"
                icon="pencil"
                onPress={() => onEdit(item.id)}
                progress={progress}
                index={0}
              />
              <RightActionButton
                label="Obriši"
                icon="trash"
                danger
                onPress={() => onDelete(item.id, item.name)}
                progress={progress}
                index={1}
              />
            </>
          ) : (
            <RightActionButton
              label="Samo prikaz"
              icon="eye"
              onPress={() =>
                router.push({ pathname: "/(tabs)/templates/template/[id]", params: { id: String(item.id) } })
              }
              progress={progress}
              index={0}
            />
          )}
        </View>
      )}
    >
      <Pressable
        onPress={() => router.push({ pathname: "/(tabs)/templates/template/[id]", params: { id: String(item.id) } })}
        style={[
          s.card,
          item.shared ? { backgroundColor: Colors.sharedBg, borderColor: Colors.sharedBorder } : null,
        ]}
      >
        <View style={s.row}>
          <View style={[s.iconCircle, item.shared ? { backgroundColor: "rgba(59,130,246,0.12)" } : null]}>
            <FontAwesome
              name={item.shared ? "share-alt" : "file-text-o"}
              size={16}
              color={item.shared ? Colors.sharedText : Colors.text}
            />
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={s.title}>{item.name}</Text>

              {item.shared ? (
                <Text style={s.badge}>
                  {item.sharedPermission === "BOOK" ? "DIJELJENO • BOOK" : "DIJELJENO • VIEW"}
                </Text>
              ) : null}
            </View>

            <Text style={s.sub}>Kućanstvo: {item.householdSize}</Text>

            {!!item.description ? (
              <Text style={s.desc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>

          <FontAwesome name="chevron-right" size={14} color={Colors.sub} />
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const sw = StyleSheet.create({
  actions: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 10,
  },
  actionWrap: {
    height: "100%",
    justifyContent: "center",
  },
  actionBtn: {
    width: 96,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  neutralBtn: { backgroundColor: "rgba(148,163,184,0.22)" },
  dangerBtn: { backgroundColor: Colors.dangerBg },
  actionText: { fontWeight: "900", fontSize: 12, color: Colors.text },
});

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontWeight: "900", color: Colors.text },
  badge: {
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.sharedBg,
    color: Colors.sharedText,
  },
  sub: { marginTop: 2, color: Colors.sub, fontWeight: "700" },
  desc: { marginTop: 4, color: "#475569", fontWeight: "600" },
});
