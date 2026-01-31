package hr.agape.item.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ItemDescriptorResponseDTO {
    private Long itemId;
    private String code;
    private String name;
    private String unit;
    private String barcode;
}