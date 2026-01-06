import Strings from "@/constants/Strings";
import { useMemo, useState } from "react";
import { ApiError } from "../apiClient";
import { authService } from "../services/authService";

type Touched = { fullName: boolean; username: boolean; password: boolean };

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

export function useRegisterForm() {
    const [fullName, setFullName] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const [touched, setTouched] = useState<Touched>({
        fullName: false,
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
        const ok =
            !!fullName.trim() &&
            !!username.trim() &&
            username.trim().length >= USERNAME_MIN &&
            !!password &&
            password.length >= PASSWORD_MIN;

        return ok && !submitting;
    }, [fullName, username, password, submitting]);

    const markTouched = (field: keyof Touched) =>
        setTouched((t) => ({ ...t, [field]: true }));

    const setFullNameSafe = (v: string) => {
        setFullName(v);
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
        setTouched({ fullName: true, username: true, password: true });
        setFormError(null);

        if (!canSubmit) return { ok: false as const };

        try {
            setSubmitting(true);

            await authService.register({
                name: fullName.trim(),
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
                else if (backendMsg && /username/i.test(backendMsg) && /exist|taken|zauzet/i.test(backendMsg))
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
        values: { fullName, username, password },
        setFullName: setFullNameSafe,
        setUsername: setUsernameSafe,
        setPassword: setPasswordSafe,

        touched,
        markTouched,

        errors: { fullNameError, usernameError, passwordError, formError },
        submitting,
        canSubmit,

        submit,
    };
}
