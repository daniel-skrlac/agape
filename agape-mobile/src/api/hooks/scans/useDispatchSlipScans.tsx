import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import dispatchSlipScanService, {
  type UploadDispatchSlipArgs,
} from "../../services/dispatchSlipScanService";
import type {
  DispatchSlipScanCorrectionRequestDTO,
  DispatchSlipScanSessionEntryRequestDTO,
} from "@/src/models/generated";

const qk = {
  one: (id: number) => ["dispatchSlipScans", "one", id] as const,
};

export function useDispatchSlipScan(scanId: number | null) {
  return useQuery({
    queryKey: scanId ? qk.one(scanId) : ["dispatchSlipScans", "one", "null"],
    queryFn: () => dispatchSlipScanService.get(Number(scanId)),
    enabled: !!scanId,
  });
}

export function useUploadDispatchSlip() {
  return useMutation({
    mutationFn: (payload: UploadDispatchSlipArgs) => dispatchSlipScanService.upload(payload),
  });
}

export function useCorrectDispatchSlip(scanId: number) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: DispatchSlipScanCorrectionRequestDTO) =>
      dispatchSlipScanService.correct(scanId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.one(scanId) }),
  });
}

export function useSaveDispatchSlipSessionEntry(scanId: number, sessionId: number) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: DispatchSlipScanSessionEntryRequestDTO) =>
      dispatchSlipScanService.saveSessionEntry(scanId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookingSessions", "one", sessionId] });
      qc.invalidateQueries({ queryKey: ["bookingSessions"] });
      qc.invalidateQueries({ queryKey: qk.one(scanId) });
    },
  });
}
