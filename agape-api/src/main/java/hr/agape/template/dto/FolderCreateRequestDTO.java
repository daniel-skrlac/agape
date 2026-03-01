package hr.agape.template.dto;

import jakarta.annotation.Nullable;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FolderCreateRequestDTO {
    @Nullable
    private Long parentId;
    @NotBlank
    private String name;
}
