package hr.agape.dispatch.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchSummaryResponseDTO {
    Long id;
    Integer documentId;
    Integer documentNumber;
    LocalDate documentDate;
    Integer partnerId;
    Integer createdBy;
}
