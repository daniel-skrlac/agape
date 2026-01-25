import Strings from "@/constants/Strings";
import { useMemo, useState } from "react";
import { ApiError } from "../apiClient";
import { authService } from "../services/authService";

type Touched = { fullName: boolean; oib: boolean; username: boolean; password: boolean };

function getBackendMessage(e: unknown) {
  if (e instanceof ApiError) {
    const body = e.body as any;
    return body?.message || e.message;
  }
  if (e instanceof Error) return e.message;
  return Strings.auth.errors.generic;
}

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

  const fullNameError = useMemo(() => {
    if (!touched.fullName) return null;
    if (!fullName.trim()) return Strings.auth.validation.fullNameRequired;
    return null;
  }, [fullName, touched.fullName]);

  // NEW: OIB validation (exactly 11 digits)
  const oibError = useMemo(() => {
    if (!touched.oib) return null;
    const v = onlyDigits(oib);
    if (!v) return (Strings.auth.validation as any)?.oibRequired ?? "OIB je obavezan.";
    if (v.length !== OIB_LEN) return (Strings.auth.validation as any)?.oibLength ?? "OIB mora imati 11 znamenki.";
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
    const ok =
      !!fullName.trim() &&
      !!o &&
      o.length === OIB_LEN &&
      !!username.trim() &&
      username.trim().length >= USERNAME_MIN &&
      !!password &&
      password.length >= PASSWORD_MIN;

    return ok && !submitting;
  }, [fullName, oib, username, password, submitting]);

  const markTouched = (field: keyof Touched) =>
    setTouched((t) => ({ ...t, [field]: true }));

  const setFullNameSafe = (v: string) => {
    setFullName(v);
    setFormError(null);
  };

  // NEW: keep OIB digits-only and max 11
  const setOibSafe = (v: string) => {
    const digits = onlyDigits(v).slice(0, OIB_LEN);
    setOib(digits);
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

  const submit = async () => {
    setTouched({ fullName: true, oib: true, username: true, password: true });
    setFormError(null);

    // Re-evaluate using current values (avoid any stale memo edge cases)
    const o = onlyDigits(oib);
    const submitOk =
      !!fullName.trim() &&
      !!o &&
      o.length === OIB_LEN &&
      !!username.trim() &&
      username.trim().length >= USERNAME_MIN &&
      !!password &&
      password.length >= PASSWORD_MIN &&
      !submitting;

    if (!submitOk) return { ok: false as const };

    try {
      setSubmitting(true);

      await authService.register({
        name: fullName.trim(),
        oib: o,
        username: username.trim(),
        password,
      });

      return { ok: true as const };
    } catch (e) {
      const msg = getBackendMessage(e);

      if (e instanceof ApiError) {
        const body = e.body as any;
        const backendMsg: string | undefined = body?.message;

        if (e.status === 0) setFormError(Strings.auth.errors.network);
        else if (
          backendMsg &&
          /username/i.test(backendMsg) &&
          /exist|taken|zauzet/i.test(backendMsg)
        )
          setFormError(Strings.auth.errors.usernameTaken);
        else setFormError(backendMsg || msg || Strings.auth.errors.generic);
      } else {
        setFormError(msg || Strings.auth.errors.generic);
      }

      return { ok: false as const };
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

    errors: { fullNameError, oibError, usernameError, passwordError, formError },
    submitting,
    canSubmit,

    submit,
  };
}
