package hr.agape.partner.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class PartnerResponseDTO {
    private Long id;               // PARTNER_ID
    private Long tenantId;         // KORISNIK_ID
    private Integer statusId;      // STATUSID
    private Integer partnerNumber; // PARTNERID
    private String taxNumber;      // OIB
    private String name;           // NAZIV
    private String address;        // ADRESA
    private String postalCode;     // PTTBROJ
    private String city;           // PTTMJESTO
    private Boolean active;        // AKTIVAN (NULL treated as true)
    private LocalDate createdAt;   // DATUM_IZRADE
    private LocalDate updatedAt;   // DATUM_IZMJENE
}
