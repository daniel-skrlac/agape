import { useEffect, useState } from "react";
import {
    getCachedSession,
    getSession,
    isSessionHydrated,
    subscribeSession,
    type AuthSession,
} from "../../sessionStore";

export function useCurrentUser() {
    const [session, setSession] = useState<AuthSession | null>(() => getCachedSession());
    const [ready, setReady] = useState(() => isSessionHydrated());

    useEffect(() => {
        let mounted = true;

        if (!isSessionHydrated()) {
            (async () => {
                try {
                    const s = await getSession();
                    if (!mounted) return;
                    setSession(s);
                } finally {
                    if (mounted) setReady(true);
                }
            })();
        }

        const unsub = subscribeSession((s) => setSession(s));

        return () => {
            mounted = false;
            unsub();
        };
    }, []);

    return { session, ready };
}
