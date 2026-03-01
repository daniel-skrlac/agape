import Strings from "@/src/constants/Strings";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateUserRequestDTO, UserResponseDTO } from "@/src/models/generated";
import { toUserMessage } from "../../apiClient";
import { userService } from "../../services/profile/userService";

type Touched = { name: boolean; username: boolean; password: boolean };
export type SubmitResult = { ok: true } | { ok: false };

const USERNAME_MIN = 3;
const PASSWORD_MIN = 6;

const qk = {
  profile: (id: number) => ["userProfile", id] as const,
};

export function useUserProfileForm(opts: { userId: number | null; user: UserResponseDTO | null }) {
  const { userId, user } = opts;
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [touched, setTouched] = useState<Touched>({ name: false, username: false, password: false });

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | null>(null);

  const loadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const id = String((user as any)?.userId ?? (user as any)?.id ?? "");
    const key = `user:${id}:${(user as any)?.username ?? ""}`;

    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;

    setName(String((user as any)?.name ?? ""));
    setUsername(String((user as any)?.username ?? ""));
    setPassword("");
    setTouched({ name: false, username: false, password: false });
    setStatusMessage(null);
    setStatusTone(null);
  }, [user]);

  const clearStatus = () => {
    setStatusMessage(null);
    setStatusTone(null);
  };

  const nameError = useMemo(() => {
    if (!touched.name) return null;
    if (!name.trim()) return Strings.auth.validation.fullNameRequired;
    return null;
  }, [name, touched.name]);

  const usernameError = useMemo(() => {
    if (!touched.username) return null;
    const u = username.trim();
    if (!u) return Strings.auth.validation.usernameRequired;
    if (u.length < USERNAME_MIN) return Strings.auth.validation.usernameMin;
    return null;
  }, [username, touched.username]);

  const passwordError = useMemo(() => {
    if (!touched.password) return null;
    if (!password) return null;
    if (password.length < PASSWORD_MIN) return Strings.auth.validation.passwordMin;
    return null;
  }, [password, touched.password]);

  const changed = useMemo(() => {
    if (!user) return false;
    const currentName = String((user as any)?.name ?? "");
    const currentUsername = String((user as any)?.username ?? "");
    return (
      name.trim() !== currentName.trim() ||
      username.trim() !== currentUsername.trim() ||
      password.length > 0
    );
  }, [user, name, username, password]);

  const canSubmit = useMemo(() => {
    const nOk = !!name.trim();
    const u = username.trim();
    const uOk = !!u && u.length >= USERNAME_MIN;
    const pOk = password.length === 0 || password.length >= PASSWORD_MIN;
    return nOk && uOk && pOk && changed;
  }, [name, username, password, changed]);

  const markTouched = (field: keyof Touched) => setTouched((t) => ({ ...t, [field]: true }));

  const mutation = useMutation({
    mutationFn: async (payload: { id: number; body: UpdateUserRequestDTO }) => {
      return userService.update(payload.id, payload.body);
    },
    onSuccess: (updated) => {
      if (!userId) return;
      qc.setQueryData(qk.profile(userId), updated);
    },
  });

  const submit = async (): Promise<SubmitResult> => {
    if (!userId) return { ok: false };

    setTouched({ name: true, username: true, password: true });
    clearStatus();

    const nOk = !!name.trim();
    const u = username.trim();
    const uOk = !!u && u.length >= USERNAME_MIN;
    const pOk = password.length === 0 || password.length >= PASSWORD_MIN;

    if (!nOk || !uOk || !pOk || !changed || mutation.isPending) return { ok: false };

    const body: UpdateUserRequestDTO = {
      name: name.trim(),
      username: u,
      ...(password.length > 0 ? { password } : {}),
    } as any;

    try {
      await mutation.mutateAsync({ id: userId, body });

      setPassword("");
      setTouched({ name: false, username: false, password: false });

      setStatusTone("success");
      setStatusMessage(Strings.profile.banners.updated);

      return { ok: true };
    } catch (e) {
      setStatusTone("error");
      setStatusMessage(toUserMessage(e, Strings.settings.errors.generic));
      return { ok: false };
    }
  };

  return {
    values: { name, username, password },
    setName: (v: string) => { setName(v); clearStatus(); },
    setUsername: (v: string) => { setUsername(v); clearStatus(); },
    setPassword: (v: string) => { setPassword(v); clearStatus(); },

    touched,
    markTouched,

    errors: { nameError, usernameError, passwordError },
    submitting: mutation.isPending,
    canSubmit,

    statusMessage,
    statusTone,
    clearStatus,

    submit,
  };
}
