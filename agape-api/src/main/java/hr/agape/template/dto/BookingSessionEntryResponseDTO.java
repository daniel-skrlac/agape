package hr.agape.template.dto;

import hr.agape.template.enumeration.DraftMode;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class BookingSessionEntryResponseDTO {
    private Long id;
    private Long partnerId;
    private Long templateId;
    private DraftMode draftMode;
    private LocalDate documentDate;
    private Object docPatches;
    private Object extraItems;
    private String note;
}
