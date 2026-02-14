import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DispatchUpdateRequestDTO } from "@/app/models/generated";
import { dispatchNoteService, type DispatchBookingsQuery } from "@/app/api/services/dispatchNoteService";

const keys = {
  list: (q: DispatchBookingsQuery) => ["dispatch-note", "list", q] as const,
  one: (id: number) => ["dispatch-note", "one", id] as const,
};

export function useDispatchNotesPage(q: DispatchBookingsQuery) {
  return useQuery({
    queryKey: keys.list(q),
    queryFn: ({ signal }) => dispatchNoteService.search(q, signal),
    staleTime: 10_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useDispatchNoteById(id: number | null) {
  return useQuery({
    queryKey: id ? keys.one(id) : ["dispatch-note", "one", "null"],
    enabled: !!id,
    queryFn: ({ signal }) => dispatchNoteService.getById(Number(id), signal),
    staleTime: 10_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function usePostDispatchNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => dispatchNoteService.postNow(id),
    onSuccess: (dto: any) => {
      const id = Number(dto?.headerId ?? dto?.id ?? NaN);
      if (Number.isFinite(id)) qc.setQueryData(keys.one(id), dto);
      qc.invalidateQueries({ queryKey: ["dispatch-note", "list"] });
    },
  });
}

export function useStornoDispatchNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: number; cancelReason?: string }) =>
      dispatchNoteService.storno(args.id, args.cancelReason),
    onSuccess: (dto: any) => {
      const id = Number(dto?.headerId ?? dto?.id ?? NaN);
      if (Number.isFinite(id)) qc.setQueryData(keys.one(id), dto);
      qc.invalidateQueries({ queryKey: ["dispatch-note", "list"] });
    },
  });
}

export function useUpdateDraftDispatchNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: number; body: Partial<DispatchUpdateRequestDTO> }) =>
      dispatchNoteService.update(args.id, args.body),
    onSuccess: (dto: any) => {
      const id = Number(dto?.headerId ?? dto?.id ?? NaN);
      if (Number.isFinite(id)) qc.setQueryData(keys.one(id), dto);
      qc.invalidateQueries({ queryKey: ["dispatch-note", "list"] });
    },
  });
}
