package hr.agape.template.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
public class FolderResponseDTO {
    private Long id;
    private Long parentId;
    private String name;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
