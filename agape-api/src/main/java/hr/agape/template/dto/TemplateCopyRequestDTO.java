package hr.agape.template.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TemplateCopyRequestDTO {
    private Long folderId;

    private String newName;
}
