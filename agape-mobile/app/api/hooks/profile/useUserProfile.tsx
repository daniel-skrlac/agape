import Strings from "@/constants/Strings";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserResponseDTO } from "@/app/models/generated";
import { toUserMessage } from "../../apiClient";
import { userService } from "../../services/profile/userService";
import { useCurrentUser } from "../useCurrentUser";

const qk = {
    profile: (id: number) => ["userProfile", id] as const,
};

export function useUserProfile() {
    const qc = useQueryClient();
    const { session } = useCurrentUser();
    const userId = (session?.userId ?? null) as number | null;

    const query = useQuery({
        queryKey: userId ? qk.profile(userId) : ["userProfile", "null"],
        enabled: !!userId,
        queryFn: ({ signal }) => userService.getById(Number(userId), signal),
    });

    const errorMessage = useMemo(() => {
        if (!query.error) return null;
        return toUserMessage(query.error, Strings.settings.errors.generic);
    }, [query.error]);

    const setUser = (u: UserResponseDTO) => {
        if (!userId) return;
        qc.setQueryData(qk.profile(userId), u);
    };

    return {
        userId,
        user: query.data ?? null,
        loading: query.isLoading,
        fetching: query.isFetching,
        errorMessage,
        refetch: query.refetch,
        setUser,
    };
}
