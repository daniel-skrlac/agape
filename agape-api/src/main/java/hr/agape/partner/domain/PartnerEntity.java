package hr.agape.partner.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PartnerEntity {
    Long id;                 // PARTNER_ID
    Long tenantId;           // KORISNIK_ID
    Integer statusId;        // STATUSID
    Integer partnerNumber;   // PARTNERID (business code)

    String taxNumber;        // OIB
    String name;             // NAZIV
    String address;          // ADRESA
    String postalCode;       // PTTBROJ
    String city;             // PTTMJESTO

    Boolean active;          // AKTIVAN (NULL treated as true)

    LocalDate createdAt;     // DATUM_IZRADE
    LocalDate updatedAt;     // DATUM_IZMJENE
}
