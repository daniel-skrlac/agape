import React, { useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import Screen from "@/components/ui/Screen";
import TabScroll from "@/components/ui/TabScroll";
import Strings from "@/constants/Strings";
import Colors from "@/constants/Colors";

import { clearSession } from "@/app/api/sessionStore";
import { useUserProfile } from "@/app/api/hooks/useUserProfile";
import { useUserProfileForm } from "@/app/api/hooks/useUserProfileForm";
import { usePullToRefresh } from "../api/hooks/usePullToRefresh";
import { ErrorCard } from "@/components/ErrorCard";
import { styles } from "./styles/ProfileScreen.styles";

export default function ProfileScreen() {
  const router = useRouter();

  const profile = useUserProfile();
  const { userId, data: user, loading, error, setData } = profile as any;

  const [edit, setEdit] = useState(false);

  const form = useUserProfileForm({
    user,
    setUser: (u: any) => setData?.(u),
  });

  const { refreshing, onRefresh } = usePullToRefresh([
    async () => {
      form.clearStatus();
      await profile.refetch?.();
    },
  ]);

  const headerName = useMemo(() => {
    if (!user) return Strings.profile.screenTitle;
    return (user as any)?.name || Strings.profile.screenTitle;
  }, [user]);

  const onLogout = async () => {
    await clearSession();
    router.replace("/");
  };

  const onSaveAndClose = async () => {
    if (!userId) return;
    const res = await form.submit(userId);
    if (res.ok) setEdit(false);
  };

  const onCancel = () => {
    setEdit(false);
    form.clearStatus();

    if (!user) return;
    form.setName((user as any)?.name ?? "");
    form.setUsername((user as any)?.username ?? "");
    form.setPassword("");
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }

  // ✅ keep pull-to-refresh even on error
  return (
    <TabScroll refreshing={refreshing} onRefresh={onRefresh} contentContainerStyle={styles.container}>
      <Screen edges={["bottom", "left", "right"]}>
        <View style={styles.container}>
          {error ? (
            <>
              <View style={styles.card}>
                <ErrorCard
                  title={Strings.profile.errors.title}
                  message={String(error)}
                  actionText="Pokušaj ponovno"
                  onAction={() => profile.refetch?.()}
                  titleLines={1}
                  messageLines={2}
                />
              </View>

              <View style={styles.card}>
                <Pressable onPress={onLogout} style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}>
                  <Text style={styles.logoutText}>{Strings.profile.buttons.logout}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.topRow}>
                  <View style={styles.avatarWrap}>
                    <Image source={{ uri: "https://i.pravatar.cc/256?img=12" }} style={styles.avatar} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>
                      {headerName}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {Strings.profile.editSubtitle}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => {
                      form.clearStatus();
                      setEdit((p) => !p);
                    }}
                    style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                  >
                    <FontAwesome name={edit ? "close" : "pencil"} size={16} color={Colors.orange} />
                    <Text style={styles.editBtnText}>
                      {edit ? Strings.profile.buttons.close : Strings.profile.buttons.edit}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Status (success / error) */}
              {form.statusMessage ? (
                form.statusTone === "success" ? (
                  <View style={[styles.banner, styles.bannerSuccess]}>
                    <Text style={[styles.bannerText, styles.bannerTextSuccess]}>{form.statusMessage}</Text>
                  </View>
                ) : (
                  <View style={styles.card}>
                    <ErrorCard
                      title="Neuspješno"
                      message={form.statusMessage}
                      actionText="Zatvori"
                      onAction={() => form.clearStatus()}
                      titleLines={1}
                      messageLines={2}
                    />
                  </View>
                )
              ) : null}

              <View style={styles.card}>
                <Field
                  label={Strings.profile.labels.fullName}
                  value={form.values.name}
                  editable={edit}
                  placeholder={Strings.profile.placeholders.fullName}
                  error={form.errors.nameError}
                  onBlur={() => form.markTouched("name")}
                  onChangeText={form.setName}
                />

                <Field
                  label={Strings.profile.labels.username}
                  value={form.values.username}
                  editable={edit}
                  placeholder={Strings.profile.placeholders.username}
                  error={form.errors.usernameError}
                  onBlur={() => form.markTouched("username")}
                  onChangeText={form.setUsername}
                  autoCapitalize="none"
                />

                <Field
                  label={Strings.profile.labels.password}
                  value={form.values.password}
                  editable={edit}
                  placeholder={edit ? Strings.profile.placeholders.passwordEdit : Strings.profile.placeholders.passwordReadonly}
                  error={form.errors.passwordError}
                  onBlur={() => form.markTouched("password")}
                  onChangeText={form.setPassword}
                  autoCapitalize="none"
                  secureTextEntry
                />

                {edit ? (
                  <View style={styles.actionsRow}>
                    <Pressable onPress={onCancel} style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}>
                      <Text style={styles.btnGhostText}>{Strings.profile.buttons.cancel}</Text>
                    </Pressable>

                    <Pressable
                      onPress={onSaveAndClose}
                      disabled={!form.canSubmit || form.submitting}
                      style={({ pressed }) => [
                        styles.btnPrimary,
                        pressed && styles.pressed,
                        (!form.canSubmit || form.submitting) && styles.disabled,
                      ]}
                    >
                      {form.submitting ? (
                        <ActivityIndicator color={Colors.onPrimaryText} />
                      ) : (
                        <Text style={styles.btnPrimaryText}>{Strings.profile.buttons.save}</Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </View>

              <View style={styles.card}>
                <Pressable onPress={onLogout} style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}>
                  <Text style={styles.logoutText}>{Strings.profile.buttons.logout}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Screen>
    </TabScroll>
  );
}

function Field(props: {
  label: string;
  value: string;
  editable: boolean;
  placeholder?: string;
  error?: string | null;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  onChangeText: (t: string) => void;
  onBlur?: () => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{props.label}</Text>

      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        onBlur={props.onBlur}
        placeholder={props.placeholder}
        editable={props.editable}
        secureTextEntry={props.secureTextEntry}
        autoCapitalize={props.autoCapitalize}
        style={[
          styles.input,
          !props.editable && styles.inputDisabled,
          props.error ? styles.inputError : null,
        ]}
        placeholderTextColor={Colors.sub}
      />

      {props.error ? <Text style={styles.errorText}>{props.error}</Text> : null}
    </View>
  );
}
