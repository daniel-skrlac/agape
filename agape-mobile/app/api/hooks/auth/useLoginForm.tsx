import Strings from "@/constants/Strings";
import { useMemo, useState } from "react";
import { ApiError, toUserMessage } from "../../apiClient";
import { authService } from "../../services/auth/authService";

type Touched = { username: boolean; password: boolean };

export function useLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<Touched>({ username: false, password: false });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const clearError = () => setFormError(null);

  const usernameError = useMemo(() => {
    if (!touched.username) return null;
    if (!username.trim()) return Strings.auth.validation.usernameRequired;
    return null;
  }, [username, touched.username]);

  const passwordError = useMemo(() => {
    if (!touched.password) return null;
    if (!password) return Strings.auth.validation.passwordRequired;
    return null;
  }, [password, touched.password]);

  const canSubmit = useMemo(() => {
    return !!username.trim() && !!password && !submitting;
  }, [username, password, submitting]);

  const markTouched = (field: keyof Touched) => setTouched((t) => ({ ...t, [field]: true }));

  const submit = async () => {
    setTouched({ username: true, password: true });
    setFormError(null);

    if (!username.trim() || !password) return { ok: false as const };

    try {
      setSubmitting(true);

      await authService.login({
        username: username.trim(),
        password,
      });

      return { ok: true as const };
    } catch (e) {
      setFormError(toUserMessage(e));
      return { ok: false as const };
    } finally {
      setSubmitting(false);
    }
  };

  return {
    values: { username, password },
    setUsername: (v: string) => {
      setUsername(v);
      setFormError(null);
    },
    setPassword: (v: string) => {
      setPassword(v);
      setFormError(null);
    },
    markTouched,
    clearError,
    errors: { usernameError, passwordError, formError },
    submitting,
    canSubmit,
    submit,
  };
}
