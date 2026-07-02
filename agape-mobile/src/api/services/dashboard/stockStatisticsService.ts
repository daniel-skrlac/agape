import { StockStatisticsResponseDTO } from "@/src/models/generated";
import { api } from "../../api";


export const stockStatisticsService = {
  get(
    args: {
      warehouseId?: number | null;
      storageGroupId?: number | null;
      documentYear?: number | null;
      documentCode?: string | null;
    },
    signal?: AbortSignal
  ) {
    const qs = new URLSearchParams();
    if (args.warehouseId != null) qs.set("warehouseId", String(args.warehouseId));
    if (args.storageGroupId != null) qs.set("storageGroupId", String(args.storageGroupId));
    if (args.documentYear != null) qs.set("documentYear", String(args.documentYear));
    if (args.documentCode) qs.set("documentCode", args.documentCode);

    return api.request<StockStatisticsResponseDTO>(
      `/api/v1/stock-statistics?${qs.toString()}`,
      { method: "GET", signal }
    );
  },
};
