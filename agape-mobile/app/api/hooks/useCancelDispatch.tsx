import { useState } from "react";
import { ApiError } from "@/app/api/apiClient";
import { api } from "@/app/api/api";
import type { DispatchResponseDTO, DispatchUpdateRequestDTO } from "@/app/models/generated";

export function useCancelDispatch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async (headerId: number, cancelReason?: string) => {
    setLoading(true);
    setError(null);

    try {
      const payload: DispatchUpdateRequestDTO = {
        cancel: true,
        cancelReason: cancelReason?.trim() || undefined,
        // do NOT send actorUserId (JsonIgnore on backend)
        // other fields omitted
      } as any;

      return await api.request<DispatchResponseDTO>(`/api/v1/dispatch-note/${headerId}`, {
        method: "PUT",
        body: payload,
      });
    } catch (e: any) {
      if (e instanceof ApiError) setError((e.body as any)?.message || e.message);
      else setError(e?.message || "Storno nije uspio.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, setError, cancel };
}
