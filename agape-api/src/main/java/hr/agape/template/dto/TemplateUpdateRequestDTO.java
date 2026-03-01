package hr.agape.template.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TemplateUpdateRequestDTO {
    private Long folderId;

    @Min(1)
    @Max(5)
    private Integer householdSize;

    private String name;
    private String description;
}
