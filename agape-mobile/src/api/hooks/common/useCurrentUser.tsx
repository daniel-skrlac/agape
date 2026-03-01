import { useEffect, useState } from "react";
import { getSession, subscribeSession, type AuthSession } from "../../sessionStore";

export function useCurrentUser() {
    const [session, setSession] = useState<AuthSession | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const s = await getSession();
                if (!mounted) return;
                setSession(s);
            } finally {
                if (mounted) setReady(true);
            }
        })();

        const unsub = subscribeSession((s) => setSession(s));

        return () => {
            mounted = false;
            unsub();
        };
    }, []);

    return { session, ready };
}
