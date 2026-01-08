package hr.agape.template.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class TemplateDocResponseDTO {
    private Long id;
    private Long documentId;
    private Integer sortOrder;
    private Boolean draft;
    private String defaultNote;
    private List<TemplateItemResponseDTO> items;
}
