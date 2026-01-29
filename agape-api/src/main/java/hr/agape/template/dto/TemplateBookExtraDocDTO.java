package hr.agape.template.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class TemplateBookExtraDocDTO {
    @NotNull
    private Long documentId;

    private Boolean draft;
    private String note;

    @NotEmpty
    private List<TemplateBookItemDTO> items;
}
