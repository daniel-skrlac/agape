package hr.agape.template.dto;

import hr.agape.template.enumeration.DispatchTemplateSharePermission;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TemplateShareCreateRequestDTO {

    @NotBlank
    private String username;

    private DispatchTemplateSharePermission permission; // optional; defaults BOOK
}