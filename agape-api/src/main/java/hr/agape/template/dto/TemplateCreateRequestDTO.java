package hr.agape.template.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TemplateCreateRequestDTO {
    private Long folderId;

    @NotNull
    @Min(1)
    @Max(5)
    private Integer householdSize;

    @NotBlank
    private String name;

    private String description;
}

