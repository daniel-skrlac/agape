package hr.agape.template.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FolderRenameRequestDTO {
    @NotBlank
    private String name;
}
