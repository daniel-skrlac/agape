package hr.agape.template.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class TemplateItemResponseDTO {
    private Long itemId;
    private BigDecimal quantity;
    private Integer sortOrder;
}
