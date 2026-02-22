import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import { Banner } from "@/components/Banner";
import Colors from "@/constants/Colors";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";
import NavigationHeader from "../../../../components/NavigationHeader";
import { useTemplateDetail, useDeleteTemplate } from "@/app/api/hooks/templates/useDispatchTemplates";

export default function PredlozakDetalji() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);

  const tQ = useTemplateDetail(id);
  const delM = useDeleteTemplate();

  const [confirmDel, setConfirmDel] = useState(false);

  const t = tQ.data;
  const err = (tQ.error as any)?.message || (delM.error as any)?.message || null;

  const backToMoji = () => {
    router.replace({ pathname: "/(tabs)/templates" });
  };

  return (
    <Screen>
      <NavigationHeader
        title="Predložak"
        subtitle={t?.name ? t.name : `#${id}`}
        fallbackHref="/(tabs)/templates"
      />

      <View style={s.container}>
        {!!err && <Banner type="error" text={err} />}

        {!t ? (
          <Text style={s.loading}>Učitavam…</Text>
        ) : (
          <>
            <View style={[s.card, t.shared ? { backgroundColor: Colors.sharedBg, borderColor: Colors.sharedBorder } : null]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={s.title}>{t.name}</Text>
                {t.shared ? <Text style={s.badge}>DIJELJENO</Text> : null}
              </View>

              {typeof t.householdSize === "number" ? (
                <Text style={s.sub}>Kućanstvo: {t.householdSize}</Text>
              ) : null}

              {!!t.description && <Text style={s.desc}>{t.description}</Text>}
            </View>

            <View style={s.grid}>
              <ActionCard
                icon="pencil"
                label="Uredi"
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/templates/template/[id]/edit",
                    params: { id: String(id) },
                  })
                }
              />
              <ActionCard
                icon="file-text-o"
                label="Dokumenti"
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/templates/template/[id]/documents",
                    params: { id: String(id) },
                  })
                }
              />
              <ActionCard
                icon="share-alt"
                label="Dijeli"
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/templates/template/[id]/share",
                    params: { id: String(id) },
                  })
                }
              />
              <ActionCard
                icon="truck"
                label="Kreiraj otpremu"
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/templates/template/[id]/otpremi",
                    params: { id: String(id) },
                  })
                }
              />
            </View>

            <Pressable style={s.danger} onPress={() => setConfirmDel(true)}>
              <FontAwesome name="trash" size={14} color={Colors.dangerText} />
              <Text style={s.dangerText}>Obriši predložak</Text>
            </Pressable>

            <CenterConfirmSheet
              visible={confirmDel}
              title="Obrisati predložak?"
              description={t?.name}
              danger
              confirmText="Obriši"
              loading={delM.isPending}
              onClose={() => setConfirmDel(false)}
              onConfirm={async () => {
                await delM.mutateAsync(id);
                setConfirmDel(false);
                backToMoji();
              }}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

function ActionCard({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <Pressable style={s.action} onPress={onPress}>
      <View style={s.actionIcon}>
        <FontAwesome name={icon} size={16} color={Colors.text} />
      </View>
      <Text style={s.actionText}>{label}</Text>
      <FontAwesome name="chevron-right" size={14} color={Colors.sub} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12 },
  loading: { color: Colors.sub, fontWeight: "800", textAlign: "center", marginTop: 20 },

  card: { backgroundColor: Colors.bg, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, padding: 14, gap: 6 },
  title: { fontSize: 18, fontWeight: "900", color: Colors.text },
  badge: { fontSize: 11, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: Colors.sharedBg, color: Colors.sharedText },
  sub: { color: Colors.sub, fontWeight: "800" },
  desc: { color: Colors.text, fontWeight: "600" },

  grid: { gap: 10 },
  action: { backgroundColor: Colors.bg, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  actionIcon: { width: 34, height: 34, borderRadius: 14, backgroundColor: "rgba(148,163,184,0.18)", alignItems: "center", justifyContent: "center" },
  actionText: { flex: 1, fontWeight: "900", color: Colors.text },

  danger: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: Colors.dangerBg },
  dangerText: { fontWeight: "900", color: Colors.dangerText },
});
