package hr.agape.template.dto;

import hr.agape.common.dto.BaseSearchFilter;
import jakarta.ws.rs.QueryParam;
import lombok.AllArgsConstructor;
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
public class BookingSessionsQueryDTO extends BaseSearchFilter {

    @QueryParam("q")
    private String q;

    @QueryParam("status")
    private String status;

    @QueryParam("dateFrom")
    private LocalDate dateFrom;

    @QueryParam("dateTo")
    private LocalDate dateTo;
}