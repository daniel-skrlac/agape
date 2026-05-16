package hr.agape.template.dto;

import jakarta.annotation.Nullable;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class TemplateBookDocPatchDTO {
    @NotNull
    private Long documentId;

    @Nullable
    private List<TemplateBookItemDTO> addItems;

    @Nullable
    private List<TemplateBookItemDTO> setItems;

    @Nullable
    private List<Long> removeItemIds;

    @Nullable
    private Boolean draftOverride;
    @Nullable
    private String noteOverride;
}
