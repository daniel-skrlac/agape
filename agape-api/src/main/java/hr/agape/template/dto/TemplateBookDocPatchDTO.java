package hr.agape.template.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class TemplateBookDocPatchDTO {
    @NotNull
    private Long documentId;

    private List<TemplateBookItemDTO> addItems;
}
