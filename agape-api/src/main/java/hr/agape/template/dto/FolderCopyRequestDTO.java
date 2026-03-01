package hr.agape.template.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FolderCopyRequestDTO {
    private Long targetParentId;

    // default true
    private Boolean includeSubfolders;
    private Boolean includeTemplates;
}
