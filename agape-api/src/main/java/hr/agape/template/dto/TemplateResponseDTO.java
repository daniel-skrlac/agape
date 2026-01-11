package hr.agape.template.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.List;

@Getter
@Setter
public class TemplateResponseDTO {
    private Long id;
    private Long folderId;
    private Integer householdSize;
    private String name;
    private String description;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private List<TemplateDocResponseDTO> documents;
    private boolean shared;
}
