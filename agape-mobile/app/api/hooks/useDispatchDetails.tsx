import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/app/api/apiClient";
import type { DispatchBookingDetailDTO } from "@/app/models/generated";
import { dispatchBookingService } from "../services/dispatchBookingService";

export function useDispatchDetails(headerId: number | null) {
  const [data, setData] = useState<DispatchBookingDetailDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(!!headerId);
  const [error, setError] = useState<string | null>(null);

  const canLoad = useMemo(() => Number.isFinite(headerId ?? NaN) && !!headerId, [headerId]);

  const mountedRef = useRef(true);
  const reqIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const clearStatus = useCallback(() => setError(null), []);

  const refetch = useCallback(async () => {
    if (!headerId) return;

    const rid = ++reqIdRef.current;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    try {
      const d = await dispatchBookingService.detail(headerId, ctrl.signal);
      if (!mountedRef.current || rid !== reqIdRef.current) return;
      setData(d);
    } catch (e: any) {
      if (!mountedRef.current || rid !== reqIdRef.current) return;
      if (e?.name === "AbortError") return;

      if (e instanceof ApiError) setError((e.body as any)?.message || e.message);
      else setError(e?.message || "Greška prilikom učitavanja detalja.");
    } finally {
      if (!mountedRef.current || rid !== reqIdRef.current) return;
      setLoading(false);
    }
  }, [headerId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!canLoad) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    void refetch();
  }, [canLoad, refetch]);

  return { data, loading, error, canLoad, refetch, setData, setError, clearStatus };
}
