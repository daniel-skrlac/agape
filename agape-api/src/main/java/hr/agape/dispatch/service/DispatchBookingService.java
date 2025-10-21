package hr.agape.dispatch.service;

import hr.agape.common.response.ServiceResponse;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.dispatch.dto.DispatchNoteRequestDTO;
import hr.agape.dispatch.dto.DispatchNoteResponseDTO;
import hr.agape.dispatch.mapper.DispatchApiMapper;
import hr.agape.document.repository.DocumentHeaderRepository;
import hr.agape.document.repository.DocumentLineRepository;
import hr.agape.document.repository.DocumentTypeRepository;
import hr.agape.document.repository.ItemRepository;
import hr.agape.document.repository.PartnerRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.TransactionSynchronizationRegistry;
import jakarta.transaction.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@ApplicationScoped
public class DispatchBookingService {

    private static final String BULK_VALIDATION_PREFIX = "Bulk validation failed at index ";

    private final DocumentHeaderRepository headerRepo;
    private final DocumentLineRepository lineRepo;
    private final DispatchApiMapper mapper;
    private final DocumentTypeRepository docTypeRepo;
    private final PartnerRepository partnerRepo;
    private final ItemRepository itemRepo;
    private final TransactionSynchronizationRegistry tsr;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public DispatchBookingService(
            DocumentHeaderRepository headerRepo,
            DocumentLineRepository lineRepo,
            DispatchApiMapper mapper,
            DocumentTypeRepository docTypeRepo,
            PartnerRepository partnerRepo,
            ItemRepository itemRepo,
            TransactionSynchronizationRegistry tsr
    ) {
        this.headerRepo = headerRepo;
        this.lineRepo = lineRepo;
        this.mapper = mapper;
        this.docTypeRepo = docTypeRepo;
        this.partnerRepo = partnerRepo;
        this.itemRepo = itemRepo;
        this.tsr = tsr;
    }

    @Transactional
    public ServiceResponse<DispatchNoteResponseDTO> bookOne(DispatchNoteRequestDTO request) {
        try {
            if (docTypeRepo.findTypeForDocumentId(request.getDocumentId()).isEmpty()) {
                return ServiceResponseDirector.errorBadRequest(
                        "Unknown documentId: " + request.getDocumentId() + " (no mapping in SD_SIFREG/SD_SIFREZ)."
                );
            }
            if (partnerRepo.isMissingOrInactive(request.getPartnerId())) {
                return ServiceResponseDirector.errorBadRequest(
                        "Partner not found or not active: partnerId=" + request.getPartnerId() + "."
                );
            }
            for (var it : request.getItems()) {
                if (itemRepo.isMissingOrInactive(it.getItemId())) {
                    return ServiceResponseDirector.errorBadRequest(
                            "Item not found or not active: itemId=" + it.getItemId() + "."
                    );
                }
            }

            var header = headerRepo.insert(mapper.toHeader(request));
            var lines = new ArrayList<>(mapper.toLines(request.getItems()));
            lineRepo.insert(header.getId(), lines);

            return ServiceResponseDirector.successOk(mapper.toResponse(header), "Dispatch note booked.");
        } catch (Exception e) {
            tsr.setRollbackOnly();
            return ServiceResponseDirector.errorInternal("Failed to book dispatch note: " + e.getMessage());
        }
    }

    @Transactional
    public ServiceResponse<List<DispatchNoteResponseDTO>> bookBulkAtomic(List<DispatchNoteRequestDTO> requests) {
        try {
            for (int i = 0; i < requests.size(); i++) {
                var r = requests.get(i);
                if (docTypeRepo.findTypeForDocumentId(r.getDocumentId()).isEmpty()) {
                    return ServiceResponseDirector.errorBadRequest(
                            BULK_VALIDATION_PREFIX + i + ": unknown documentId " + r.getDocumentId() +
                                    " (no mapping in SD_SIFREG/SD_SIFREZ)."
                    );
                }
                if (partnerRepo.isMissingOrInactive(r.getPartnerId())) {
                    return ServiceResponseDirector.errorBadRequest(
                            BULK_VALIDATION_PREFIX + i + ": partner not found or not active, partnerId=" +
                                    r.getPartnerId() + "."
                    );
                }
                for (var it : r.getItems()) {
                    if (itemRepo.isMissingOrInactive(it.getItemId())) {
                        return ServiceResponseDirector.errorBadRequest(
                                BULK_VALIDATION_PREFIX + i + ": item not found or not active, itemId=" +
                                        it.getItemId() + "."
                        );
                    }
                }
            }

            var headersToInsert = requests.stream()
                    .map(mapper::toHeader)
                    .collect(Collectors.toList());

            var persistedHeaders = headerRepo.insertAll(headersToInsert);

            for (int i = 0; i < requests.size(); i++) {
                var req = requests.get(i);
                var hdr = persistedHeaders.get(i);
                var lines = new ArrayList<>(mapper.toLines(req.getItems()));
                lineRepo.insert(hdr.getId(), lines);
            }

            var responseList = persistedHeaders.stream()
                    .map(mapper::toResponse)
                    .collect(Collectors.toList());

            return ServiceResponseDirector.successOk(responseList, "Bulk dispatch booking completed.");
        } catch (Exception e) {
            tsr.setRollbackOnly();
            return ServiceResponseDirector.errorInternal("Bulk booking failed; nothing was booked: " + e.getMessage());
        }
    }
}
