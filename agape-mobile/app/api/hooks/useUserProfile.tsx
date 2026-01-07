import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../apiClient";
import { userService } from "../services/userService";
import { useCurrentUser } from "./useCurrentUser";

import type { UserResponseDTO } from "../../models/generated";

export function useUserProfile() {
    const { session } = useCurrentUser();
    const userId = session?.userId ?? null;

    const [data, setData] = useState<UserResponseDTO | null>(null);
    const [loading, setLoading] = useState<boolean>(!!userId);
    const [error, setError] = useState<string | null>(null);

    const canLoad = useMemo(() => !!userId, [userId]);

    const refetch = async () => {
        if (!userId) return;

        const ctrl = new AbortController();
        setLoading(true);
        setError(null);

        try {
            const u = await userService.getById(userId, ctrl.signal);
            setData(u);
        } catch (e: any) {
            if (e instanceof ApiError) setError((e.body as any)?.message || e.message);
            else setError(e?.message || "Failed to load profile.");
        } finally {
            setLoading(false);
        }

        return () => ctrl.abort();
    };

    useEffect(() => {
        let mounted = true;
        const ctrl = new AbortController();

        (async () => {
            if (!userId) {
                setLoading(false);
                setData(null);
                setError(null);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const u = await userService.getById(userId, ctrl.signal);
                if (!mounted) return;
                setData(u);
            } catch (e: any) {
                if (!mounted) return;
                if (e instanceof ApiError) setError((e.body as any)?.message || e.message);
                else setError(e?.message || "Failed to load profile.");
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
            ctrl.abort();
        };
    }, [userId]);

    return { userId, data, loading, error, canLoad, refetch, setData };
}
