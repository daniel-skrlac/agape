package hr.agape.dispatch.scan.mapper;

import hr.agape.dispatch.scan.dto.BookingSessionScanEntryUpsertRequestDTO;
import hr.agape.dispatch.scan.dto.BookingSessionScanLineCandidateDTO;
import hr.agape.dispatch.scan.dto.BookingSessionScanLineDTO;
import hr.agape.dispatch.scan.dto.BookingSessionScanLineValidationDTO;
import hr.agape.dispatch.scan.dto.BookingSessionScanValidateRequestDTO;
import hr.agape.dispatch.scan.dto.BookingSessionScanValidateResponseDTO;
import hr.agape.dispatch.scan.dto.DispatchSlipParsedDTO;
import hr.agape.dispatch.scan.dto.DispatchSlipParsedLineDTO;
import hr.agape.item.dto.ItemDescriptorResponseDTO;
import hr.agape.template.domain.DispatchBookingSessionEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.ReportingPolicy;

import java.util.List;
import java.util.Objects;

@Mapper(componentModel = "cdi", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface BookingSessionScanEntryMapper {

    BookingSessionScanLineValidationDTO toValidationLine(BookingSessionScanLineCandidateDTO source);

    List<BookingSessionScanLineValidationDTO> toValidationLines(List<BookingSessionScanLineCandidateDTO> source);

    BookingSessionScanLineCandidateDTO toCandidateLine(BookingSessionScanLineDTO source);

    DispatchSlipParsedLineDTO toParsedLine(BookingSessionScanLineValidationDTO source);

    List<DispatchSlipParsedLineDTO> toParsedLines(List<BookingSessionScanLineValidationDTO> source);

    @Mapping(source = "itemId", target = "itemId")
    @Mapping(source = "code", target = "itemCode")
    @Mapping(source = "name", target = "itemName")
    @Mapping(source = "unit", target = "unit")
    void applyItem(ItemDescriptorResponseDTO item, @MappingTarget BookingSessionScanLineValidationDTO line);

    default BookingSessionScanValidateRequestDTO toValidateRequest(BookingSessionScanEntryUpsertRequestDTO req) {
        BookingSessionScanValidateRequestDTO dto = new BookingSessionScanValidateRequestDTO();
        dto.setPartnerId(req.getPartnerId());
        dto.setTemplateId(req.getTemplateId());
        dto.setDocumentId(req.getDocumentId());
        dto.setDocumentDate(req.getDocumentDate());
        dto.setNote(req.getNote());
        dto.setLines(req.getLines() == null ? List.of() : req.getLines().stream().map(this::toCandidateLine).toList());
        return dto;
    }

    default BookingSessionScanValidateResponseDTO toValidationResponse(
            DispatchBookingSessionEntity session,
            BookingSessionScanValidateRequestDTO req,
            String partnerName,
            List<BookingSessionScanLineValidationDTO> lines,
            Boolean partnerResolved,
            Boolean allValid
    ) {
        BookingSessionScanValidateResponseDTO dto = new BookingSessionScanValidateResponseDTO();
        dto.setSessionId(session.getId());
        dto.setPartnerId(req.getPartnerId());
        dto.setPartnerName(partnerName);
        dto.setTemplateId(req.getTemplateId());
        dto.setDocumentId(req.getDocumentId());
        dto.setDocumentDate(req.getDocumentDate());
        dto.setPartnerResolved(partnerResolved);
        dto.setRequiresManualPartner(!Boolean.TRUE.equals(partnerResolved));
        dto.setLines(lines);
        dto.setAllValid(allValid);
        return dto;
    }

    default DispatchSlipParsedDTO toParsedDto(
            DispatchBookingSessionEntity session,
            BookingSessionScanValidateResponseDTO validation,
            String note,
            String rawText
    ) {
        DispatchSlipParsedDTO dto = new DispatchSlipParsedDTO();
        dto.setBookingSessionId(session.getId());
        dto.setPartnerId(validation.getPartnerId());
        dto.setPartnerName(validation.getPartnerName());
        dto.setTemplateId(validation.getTemplateId());
        dto.setDocumentId(validation.getDocumentId());
        dto.setWarehouseId(session.getWarehouseId());
        dto.setDocumentDate(validation.getDocumentDate());
        dto.setRawText(rawText);
        dto.setPartnerResolved(validation.getPartnerResolved());
        dto.setRequiresManualPartner(validation.getRequiresManualPartner());
        dto.setAllValid(validation.getAllValid());
        dto.setNote(resolveScanNote(note));
        dto.setLines(toParsedLines(validation.getLines()));
        dto.setWarnings(validation.getLines() == null
                ? List.of()
                : validation.getLines().stream()
                .map(BookingSessionScanLineValidationDTO::getWarning)
                .filter(Objects::nonNull)
                .distinct()
                .toList());
        return dto;
    }

    private String resolveScanNote(String note) {
        if (note != null && !note.isBlank()) {
            return note.trim();
        }

        return "Skenirano sa papira";
    }
}
