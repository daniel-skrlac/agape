import { api } from "../api";
import type { PagedResultDTO } from "@/app/models/generated";

export type UserDirectoryItem = { id: number; username: string; name: string };

export const userDirectoryService = {
  pageUsers(args: { page: number; size: number; q: string }, signal?: AbortSignal) {
    const qs = new URLSearchParams();
    qs.set("page", String(args.page));
    qs.set("size", String(args.size));
    if (args.q) qs.set("q", args.q);
    return api.request<PagedResultDTO<UserDirectoryItem>>(`/api/v1/users?${qs.toString()}`, { method: "GET", signal });
  },
};
