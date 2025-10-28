package hr.agape.dispatch.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchSummaryResponseDTO {
    private Long id;
    private Long documentId;
    private Long documentNumber;
    private LocalDate documentDate;
    private Long partnerId;
    private Long createdBy;
    private OffsetDateTime createdAt;
}