import Strings from "@/constants/Strings";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../apiClient";
import { userService } from "../services/userService";
import type { UserResponseDTO } from "@/app/models/generated";

type Touched = { name: boolean; username: boolean; password: boolean };

const USERNAME_MIN = 3;
const PASSWORD_MIN = 6;

function getBackendMessage(e: unknown) {
    if (e instanceof ApiError) {
        const body = e.body as any;
        return body?.message || e.message;
    }
    if (e instanceof Error) return e.message;
    return Strings.auth.errors.generic;
}

export function useUserProfileForm(opts: {
    user: UserResponseDTO | null;
    setUser: (u: UserResponseDTO) => void;
}) {
    const { user, setUser } = opts;

    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const [touched, setTouched] = useState<Touched>({
        name: false,
        username: false,
        password: false,
    });

    const [submitting, setSubmitting] = useState(false);

    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [statusTone, setStatusTone] = useState<"success" | "error" | null>(null);

    const loadedUserKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if (!user) return;

        const id = String((user as any)?.userId ?? (user as any)?.id ?? "");
        const key = `user:${id}:${(user as any)?.username ?? ""}`;

        if (loadedUserKeyRef.current !== key) {
            loadedUserKeyRef.current = key;

            setName((user as any)?.name ?? "");
            setUsername((user as any)?.username ?? "");
            setPassword("");

            setTouched({ name: false, username: false, password: false });

            setStatusMessage(null);
            setStatusTone(null);
        }
    }, [user]);

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

        return nOk && uOk && pOk && changed && !submitting;
    }, [name, username, password, changed, submitting]);

    const markTouched = (field: keyof Touched) =>
        setTouched((t) => ({ ...t, [field]: true }));

    const clearStatus = () => {
        setStatusMessage(null);
        setStatusTone(null);
    };

    const setNameSafe = (v: string) => {
        setName(v);
        clearStatus();
    };

    const setUsernameSafe = (v: string) => {
        setUsername(v);
        clearStatus();
    };

    const setPasswordSafe = (v: string) => {
        setPassword(v);
        clearStatus();
    };

    const submit = async (userId: number) => {
        setTouched({ name: true, username: true, password: true });
        clearStatus();

        if (!canSubmit) return { ok: false as const };

        try {
            setSubmitting(true);

            const payload: any = {
                name: name.trim(),
                username: username.trim(),
            };

            if (password.length > 0) payload.password = password;

            const updated = await userService.update(userId, payload);

            setUser(updated as any);

            setPassword("");
            setTouched({ name: false, username: false, password: false });

            setStatusTone("success");
            setStatusMessage(Strings.profile.banners.updated);

            return { ok: true as const };
        } catch (e) {
            const msg = getBackendMessage(e);

            if (e instanceof ApiError) {
                const body = e.body as any;
                const backendMsg: string | undefined = body?.message;

                let shown =
                    backendMsg ||
                    msg ||
                    Strings.auth.errors.generic;

                if (e.status === 0) shown = Strings.auth.errors.network;
                else if (
                    backendMsg &&
                    /username/i.test(backendMsg) &&
                    /exist|taken|zauzet/i.test(backendMsg)
                ) {
                    shown = Strings.auth.errors.usernameTaken;
                }

                setStatusTone("error");
                setStatusMessage(shown);
            } else {
                setStatusTone("error");
                setStatusMessage(msg || Strings.auth.errors.generic);
            }

            return { ok: false as const };
        } finally {
            setSubmitting(false);
        }
    };

    return {
        values: { name, username, password },
        setName: setNameSafe,
        setUsername: setUsernameSafe,
        setPassword: setPasswordSafe,

        touched,
        markTouched,

        errors: { nameError, usernameError, passwordError },
        submitting,
        canSubmit,

        statusMessage,
        statusTone,

        clearStatus,
        submit,
    };
}
