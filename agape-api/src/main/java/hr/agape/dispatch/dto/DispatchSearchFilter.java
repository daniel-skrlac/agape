package hr.agape.dispatch.dto;

import hr.agape.common.dto.BaseSearchFilter;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.QueryParam;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;

@EqualsAndHashCode(callSuper = true)
@Data
public class DispatchSearchFilter extends BaseSearchFilter {

    @QueryParam("createdBy")
    private Long createdBy;          // SD_GLAVA.IZRADIO

    @QueryParam("documentId")
    @NotNull(message = "documentId is required")
    private Long documentId;         // SD_GLAVA.DOKUMENT_ID

    @QueryParam("partnerId")
    private Long partnerId;          // SD_GLAVA.PARTNER_ID

    @QueryParam("dateFrom")
    private LocalDate dateFrom;         // SD_GLAVA.DATUM_DOKUMENTA >=

    @QueryParam("dateTo")
    private LocalDate dateTo;           // SD_GLAVA.DATUM_DOKUMENTA <=
}
