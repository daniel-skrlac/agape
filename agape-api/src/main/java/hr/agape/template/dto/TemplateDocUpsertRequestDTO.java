package hr.agape.template.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TemplateDocUpsertRequestDTO {
    @NotNull
    private Long documentId;
    private Integer sortOrder;
    private Boolean draft;
    private String defaultNote;
}
