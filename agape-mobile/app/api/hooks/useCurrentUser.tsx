import { useEffect, useState } from "react";
import { getSession, type AuthSession } from "../sessionStore";

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

        return () => {
            mounted = false;
        };
    }, []);

    return { session, ready };
}
