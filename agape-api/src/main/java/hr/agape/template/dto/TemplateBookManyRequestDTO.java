package hr.agape.template.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class TemplateBookManyRequestDTO {
    @NotNull
    private Long templateId;

    @NotEmpty
    private List<Long> partnerIds;

    private LocalDate documentDate;
    private Boolean draftOverride;
}
