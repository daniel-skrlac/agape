package hr.agape.template.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FolderMoveRequestDTO {
    private Long targetParentId;
}
