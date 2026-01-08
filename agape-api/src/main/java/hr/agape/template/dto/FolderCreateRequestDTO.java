package hr.agape.template.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FolderCreateRequestDTO {
    private Long parentId;
    @NotBlank
    private String name;
}
