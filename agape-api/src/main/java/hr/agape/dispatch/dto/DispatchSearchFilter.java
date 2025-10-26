package hr.agape.dispatch.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.QueryParam;
import lombok.Data;

import java.time.LocalDate;

@Data
public class DispatchSearchFilter {

    @QueryParam("page")
    @DefaultValue("0")
    private int page;

    @QueryParam("size")
    @DefaultValue("10")
    private int size;

    @QueryParam("createdBy")
    private Integer createdBy;          // SD_GLAVA.IZRADIO

    @QueryParam("documentId")
    @NotNull(message = "documentId is required")
    private Integer documentId;         // SD_GLAVA.DOKUMENT_ID

    @QueryParam("partnerId")
    private Integer partnerId;          // SD_GLAVA.PARTNER_ID

    @QueryParam("dateFrom")
    private LocalDate dateFrom;         // SD_GLAVA.DATUM_DOKUMENTA >=

    @QueryParam("dateTo")
    private LocalDate dateTo;           // SD_GLAVA.DATUM_DOKUMENTA <=
}
