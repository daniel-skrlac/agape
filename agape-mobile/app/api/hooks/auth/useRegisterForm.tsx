import Strings from "@/constants/Strings";
import { useMemo, useState } from "react";
import { authService } from "@/app/api/services/authService";
import { toUserMessage } from "../../apiClient";

type Touched = { fullName: boolean; oib: boolean; username: boolean; password: boolean };
export type SubmitResult = { ok: true } | { ok: false };

const USERNAME_MIN = 3;
const PASSWORD_MIN = 6;
const OIB_LEN = 11;

const onlyDigits = (s: string) => s.replace(/\D+/g, "");

export function useRegisterForm() {
  const [fullName, setFullName] = useState("");
  const [oib, setOib] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [touched, setTouched] = useState<Touched>({
    fullName: false,
    oib: false,
    username: false,
    password: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const clearError = () => setFormError(null);

  const fullNameError = useMemo(() => {
    if (!touched.fullName) return null;
    if (!fullName.trim()) return Strings.auth.validation.fullNameRequired;
    return null;
  }, [fullName, touched.fullName]);

  const oibError = useMemo(() => {
    if (!touched.oib) return null;
    const v = onlyDigits(oib);
    if (!v) return "OIB je obavezan.";
    if (v.length !== OIB_LEN) return "OIB mora imati 11 znamenki.";
    return null;
  }, [oib, touched.oib]);

  const usernameError = useMemo(() => {
    if (!touched.username) return null;
    const u = username.trim();
    if (!u) return Strings.auth.validation.usernameRequired;
    if (u.length < USERNAME_MIN) return Strings.auth.validation.usernameMin;
    return null;
  }, [username, touched.username]);

  const passwordError = useMemo(() => {
    if (!touched.password) return null;
    if (!password) return Strings.auth.validation.passwordRequired;
    if (password.length < PASSWORD_MIN) return Strings.auth.validation.passwordMin;
    return null;
  }, [password, touched.password]);

  const canSubmit = useMemo(() => {
    const o = onlyDigits(oib);
    return (
      !!fullName.trim() &&
      o.length === OIB_LEN &&
      username.trim().length >= USERNAME_MIN &&
      password.length >= PASSWORD_MIN &&
      !submitting
    );
  }, [fullName, oib, username, password, submitting]);

  const markTouched = (field: keyof Touched) => setTouched((t) => ({ ...t, [field]: true }));

  const setFullNameSafe = (v: string) => {
    setFullName(v);
    setFormError(null);
  };

  const setOibSafe = (v: string) => {
    setOib(onlyDigits(v).slice(0, OIB_LEN));
    setFormError(null);
  };

  const setUsernameSafe = (v: string) => {
    setUsername(v);
    setFormError(null);
  };

  const setPasswordSafe = (v: string) => {
    setPassword(v);
    setFormError(null);
  };

  const submit = async (): Promise<SubmitResult> => {
    if (submitting) return { ok: false };

    setTouched({ fullName: true, oib: true, username: true, password: true });
    setFormError(null);

    const o = onlyDigits(oib);
    const valid =
      !!fullName.trim() &&
      o.length === OIB_LEN &&
      username.trim().length >= USERNAME_MIN &&
      password.length >= PASSWORD_MIN;

    if (!valid) return { ok: false };

    try {
      setSubmitting(true);

      await authService.register({
        name: fullName.trim(),
        oib: o,
        username: username.trim(),
        password,
      });

      return { ok: true };
    } catch (e) {
      setFormError(toUserMessage(e));
      return { ok: false };
    } finally {
      setSubmitting(false);
    }
  };

  return {
    values: { fullName, oib, username, password },

    setFullName: setFullNameSafe,
    setOib: setOibSafe,
    setUsername: setUsernameSafe,
    setPassword: setPasswordSafe,

    touched,
    markTouched,

    clearError,
    errors: { fullNameError, oibError, usernameError, passwordError, formError },

    submitting,
    canSubmit,
    submit,
  };
}
