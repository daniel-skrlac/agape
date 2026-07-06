import { QueryClient } from "@tanstack/react-query";
import { isRequestCancelled } from "@/src/api/apiClient";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 10 * 60_000,
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: (failureCount, error) => {
                if (isRequestCancelled(error)) return false;
                return failureCount < 1;
            },
            throwOnError: false,
        },
        mutations: {
            retry: false,
        },
    },
});
