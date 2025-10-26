package hr.agape.document.warehouse.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WarehouseDTO {
    private Integer warehouseId; // SD_SIFREG.SKLADISTE_ID
    private String name;        // optional: SKLADISTE.NAZIV if exists, else null
}
