package hr.agape.dispatch.service;

import hr.agape.dispatch.config.DispatchMkConfig;
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

@ApplicationScoped
public class DispatchBookingTransactionService {

    private final DocumentHeaderRepository headerRepo;
    private final DocumentLineRepository lineRepo;
    private final DocumentRepository documentRepository;
    private final DispatchMkConfig mkCfg;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public DispatchBookingTransactionService(
            DocumentHeaderRepository headerRepo,
            DocumentLineRepository lineRepo,
            DocumentRepository documentRepository,
            DispatchMkConfig mkCfg
    ) {
        this.headerRepo = headerRepo;
        this.lineRepo = lineRepo;
        this.documentRepository = documentRepository;
        this.mkCfg = mkCfg;
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
    @Transactional(Transactional.TxType.REQUIRED)
    public DocumentHeaderEntity cancelPosted(Long headerId, Long actorOib, String reason) throws SQLException {
        return headerRepo.cancelDispatch(headerId, actorOib, reason);
    }

    /**
     * REQUIRES_NEW:
     * Calls legacy PL/SQL posting procedure which commits internally.
     * This MUST be isolated from outer transactions.
     */
    @Transactional(Transactional.TxType.REQUIRES_NEW)
    public void postViaMkProcedure(Long headerId, String actorOibDigits) throws SQLException {
        documentRepository.bookDocument(
                headerId,
                actorOibDigits,
                mkCfg.knjizitiNaSkladiste(),
                mkCfg.knjizitiUkPopisa(),
                mkCfg.knjizitiNormative(),
                mkCfg.generirajZapisnik(),
                mkCfg.azurirajProdajne(),
                mkCfg.azurirajNabavne()
        );
    }
}
