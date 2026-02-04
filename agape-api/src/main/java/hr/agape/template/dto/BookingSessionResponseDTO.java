package hr.agape.template.dto;

import hr.agape.template.enumeration.BookingSessionStatus;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

@Getter
@Setter
public class BookingSessionResponseDTO {
    private Long id;
    private String title;
    private String note;
    private Long warehouseId;
    private LocalDate documentDate;
    private BookingSessionStatus status;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private OffsetDateTime finalizedAt;

    private Object finalResult;

    private List<BookingSessionEntryResponseDTO> entries;
}
