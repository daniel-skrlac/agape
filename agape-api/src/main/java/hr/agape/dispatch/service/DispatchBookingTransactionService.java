package hr.agape.dispatch.service;

import hr.agape.dispatch.config.DispatchDocumentConfig;
import hr.agape.dispatch.config.DispatchStornoDocumentConfig;
import hr.agape.document.domain.DocumentHeaderEntity;
import hr.agape.document.dto.DocumentItemLineDTO;
import hr.agape.document.repository.DocumentHeaderRepository;
import hr.agape.document.repository.DocumentLineRepository;
import hr.agape.document.repository.DocumentRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.sql.SQLException;
import java.util.List;

import static jakarta.transaction.Transactional.TxType.NOT_SUPPORTED;

@ApplicationScoped
public class DispatchBookingTransactionService {

    private final DocumentHeaderRepository headerRepo;
    private final DocumentLineRepository lineRepo;
    private final DocumentRepository documentRepository;
    private final DispatchDocumentConfig dispatchDocumentConfig;
    private final DispatchStornoDocumentConfig dispatchStornoDocumentConfig;

    @Inject
    public DispatchBookingTransactionService(
            DocumentHeaderRepository headerRepo,
            DocumentLineRepository lineRepo,
            DocumentRepository documentRepository,
            DispatchDocumentConfig dispatchDocumentConfig, DispatchStornoDocumentConfig dispatchStornoDocumentConfig
    ) {
        this.headerRepo = headerRepo;
        this.lineRepo = lineRepo;
        this.documentRepository = documentRepository;
        this.dispatchDocumentConfig = dispatchDocumentConfig;
        this.dispatchStornoDocumentConfig = dispatchStornoDocumentConfig;
    }

    /**
     * REQUIRED:
     * Insert header + lines as DRAFT in ONE TX.
     */
    @Transactional(Transactional.TxType.REQUIRED)
    public DocumentHeaderEntity createDraft(DocumentHeaderEntity headerInput, List<DocumentItemLineDTO> lines) throws SQLException {
        DocumentHeaderEntity created = headerRepo.insert(headerInput, false);
        lineRepo.insert(created.getId(), lines);
        return created;
    }

    /**
     * REQUIRED:
     * Update draft lines + header in ONE TX.
     */
    @Transactional(Transactional.TxType.REQUIRED)
    public DocumentHeaderEntity updateDraft(
            Long headerId,
            Long partnerId,
            String note,
            List<DocumentItemLineDTO> newLines
    ) throws SQLException {
        lineRepo.deleteByHeader(headerId);
        lineRepo.insert(headerId, newLines);

        return headerRepo.updateDraftHeader(headerId, partnerId, note);
    }

    /**
     * REQUIRED:
     * Cancel already posted document (simple UPDATE).
     */
    @Deprecated
    @Transactional(Transactional.TxType.REQUIRED)
    public DocumentHeaderEntity cancelPosted(Long headerId, Long actorOib, String reason) throws SQLException {
        return headerRepo.cancelDispatch(headerId, actorOib, reason);
    }

    @Transactional(NOT_SUPPORTED)
    public void postViaMkProcedure(Long headerId, String actorOibDigits) throws SQLException {
        documentRepository.bookDocument(
                headerId,
                actorOibDigits,
                dispatchDocumentConfig.knjizitiNaSkladiste(),
                dispatchDocumentConfig.knjizitiUkPopisa(),
                dispatchDocumentConfig.knjizitiNormative(),
                dispatchDocumentConfig.generirajZapisnik(),
                dispatchDocumentConfig.azurirajProdajne(),
                dispatchDocumentConfig.azurirajNabavne()
        );
    }

    @Transactional(NOT_SUPPORTED)
    public void cancelViaProcedure(Long headerId, String cancelReason) throws SQLException {
        documentRepository.cancelDocument(
                headerId,
                dispatchStornoDocumentConfig.naSkladiste(),
                dispatchStornoDocumentConfig.ukPopisa(),
                dispatchStornoDocumentConfig.veznid(),
                dispatchStornoDocumentConfig.postaviOznaku()
        );

        if (cancelReason != null && !cancelReason.isBlank()) {
            headerRepo.setCancelNote(headerId, cancelReason);
        }
    }
}
