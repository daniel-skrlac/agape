package hr.agape.template.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TemplateCopyRequestDTO {
    private String newName;

    // Optional: place copy into a folder
    private Long folderId;
}
