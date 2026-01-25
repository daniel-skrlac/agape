package hr.agape.template.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class TemplateBookOneRequestDTO {
    @NotNull
    private Long templateId;

    @NotNull
    private Long warehouseId;

    @NotNull
    private Long partnerId;

    private LocalDate documentDate;
    private Boolean draftOverride;
}

