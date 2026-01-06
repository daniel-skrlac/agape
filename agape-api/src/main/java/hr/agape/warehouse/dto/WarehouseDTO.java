package hr.agape.warehouse.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class WarehouseDTO {
    private Long warehouseId;
    private String name; //maybe we will add this in future
}
