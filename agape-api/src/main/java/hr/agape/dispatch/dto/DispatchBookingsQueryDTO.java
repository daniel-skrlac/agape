// hr/agape/dispatch/dto/DispatchBookingsQueryDTO.java
package hr.agape.dispatch.dto;

import hr.agape.common.dto.BaseSearchFilter;
import hr.agape.dispatch.enumeration.DispatchBookingStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.LocalDate;

@EqualsAndHashCode(callSuper = true)
@Data
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class DispatchBookingsQueryDTO extends BaseSearchFilter {
    private Long warehouseId;

    /**
     * Free-text search over document name/code.
     * Matches SD_SIFREZ.NAZIVDOKUMENTA and SD_SIFREZ.DOKUMENTID.
     */
    private String q;

    /**
     * Optional exact document code filter (e.g. "OTPREMNICA").
     * If null -> resolved by warehouse to dispatch documentId (OTPREMNICA in your flow).
     */
    private String documentCode;

    /**
     * ALL / DRAFT / FINAL
     */
    @Builder.Default
    private DispatchBookingStatus status = DispatchBookingStatus.ALL;

    /**
     * Filter by bookedAt date (bookedAt = COALESCE(DATUM_KNJIZENJA, DATUM_IZRADE))
     */
    private LocalDate dateFrom;
    private LocalDate dateTo;
}
