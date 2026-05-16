import { useMutation, useQueryClient } from "@tanstack/react-query";

import dispatchSlipScanService, {
  type ParseDispatchSlipArgs,
} from "../../services/dispatchSlipScanService";
import type {
  BookingSessionScanEntryUpsertRequestDTO,
  BookingSessionScanValidateRequestDTO,
} from "@/src/models/generated";

export function useParseDispatchSlip() {
  return useMutation({
    mutationFn: (payload: ParseDispatchSlipArgs) => dispatchSlipScanService.parse(payload),
  });
}

export function useValidateDispatchSlipScan(sessionId: number) {
  return useMutation({
    mutationFn: (payload: BookingSessionScanValidateRequestDTO) =>
      dispatchSlipScanService.validate(sessionId, payload),
  });
}

export function useSaveDispatchSlipScanEntry(sessionId: number) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: BookingSessionScanEntryUpsertRequestDTO) =>
      dispatchSlipScanService.saveEntry(sessionId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookingSessions", "one", sessionId] });
      qc.invalidateQueries({ queryKey: ["bookingSessions"] });
    },
  });
}
