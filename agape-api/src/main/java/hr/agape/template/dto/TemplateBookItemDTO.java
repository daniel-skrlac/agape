package hr.agape.template.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class TemplateBookItemDTO {
    @NotNull
    private Long itemId;

    @NotNull
    private BigDecimal quantity;
}