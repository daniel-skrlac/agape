// hr/agape/dispatch/dto/DispatchBookingsQueryDTO.java
package hr.agape.dispatch.dto;

import hr.agape.common.dto.BaseSearchFilter;
import hr.agape.dispatch.enumeration.DispatchBookingStatus;
import jakarta.ws.rs.QueryParam;
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

    @QueryParam("warehouseId")
    private Long warehouseId;

    @QueryParam("q")
    private String q;

    @QueryParam("documentCode")
    private String documentCode;

    @QueryParam("status")
    @Builder.Default
    private DispatchBookingStatus status = DispatchBookingStatus.ALL;

    @QueryParam("dateFrom")
    private LocalDate dateFrom;

    @QueryParam("dateTo")
    private LocalDate dateTo;
}
