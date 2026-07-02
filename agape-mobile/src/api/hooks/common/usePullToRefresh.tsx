import { useCallback, useRef, useState } from "react";

type Refetcher = (() => Promise<unknown>) | (() => unknown);

export function usePullToRefresh(refetchers: Refetcher[]) {
    const [refreshing, setRefreshing] = useState(false);
    const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
    const refreshingRef = useRef(false);

    const onRefresh = useCallback(async () => {
        if (refreshingRef.current) return;

        refreshingRef.current = true;
        setRefreshing(true);
        try {
            await Promise.allSettled(refetchers.filter(Boolean).map((fn) => Promise.resolve(fn())));
            setLastRefreshedAt(Date.now());
        } finally {
            refreshingRef.current = false;
            setRefreshing(false);
        }
    }, [refetchers]);

    return { refreshing, onRefresh, lastRefreshedAt };
}
