import { useEffect, useMemo, useRef, useState } from "react";
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

  const refetch = async () => {
    if (!headerId) return;
    const rid = ++reqIdRef.current;
    const ctrl = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const d = await dispatchBookingService.detail(headerId, ctrl.signal);
      if (!mountedRef.current || rid !== reqIdRef.current) return;
      setData(d);
    } catch (e: any) {
      if (!mountedRef.current || rid !== reqIdRef.current) return;
      if (e instanceof ApiError) setError((e.body as any)?.message || e.message);
      else setError(e?.message || "Greška prilikom učitavanja detalja.");
    } finally {
      if (!mountedRef.current || rid !== reqIdRef.current) return;
      setLoading(false);
    }

    return () => ctrl.abort();
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!canLoad) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerId]);

  return { data, loading, error, canLoad, refetch, setData, setError };
}
