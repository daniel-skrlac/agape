import { useCallback, useState } from "react";

type Refetcher = (() => Promise<unknown>) | (() => unknown);

export function usePullToRefresh(refetchers: Refetcher[]) {
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        if (refreshing) return;

        setRefreshing(true);
        try {
            await Promise.allSettled(refetchers.filter(Boolean).map((fn) => Promise.resolve(fn())));
        } finally {
            setRefreshing(false);
        }
    }, [refetchers, refreshing]);

    return { refreshing, onRefresh };
}
