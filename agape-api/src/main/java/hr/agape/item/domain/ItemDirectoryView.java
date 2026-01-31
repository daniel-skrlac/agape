package hr.agape.item.domain;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ItemDirectoryView {
    private Long itemId;
    private String code;
    private String name;
    private String unit;
    private String barcode;
}
