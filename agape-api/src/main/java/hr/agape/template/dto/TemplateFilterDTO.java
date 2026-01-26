package hr.agape.template.dto;

import lombok.Data;

@Data
public class TemplateFilterDTO {
    private Long folderId;
    private String name;
    private Boolean includeShared;
    private Boolean rootOnly;
}
