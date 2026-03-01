package hr.agape.template.dto;

import hr.agape.template.enumeration.DraftMode;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class BookingSessionEntryUpsertRequestDTO {

    @NotNull
    private Long partnerId;

    @NotNull
    private Long templateId;

    @NotNull
    private DraftMode draftMode;

    private LocalDate documentDate;

    private List<TemplateBookDocPatchDTO> docPatches;

    private List<TemplateBookItemDTO> extraItems;

    private String note;
}
