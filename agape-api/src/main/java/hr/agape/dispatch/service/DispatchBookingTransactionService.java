package hr.agape.dispatch.service;

import hr.agape.common.config.AgapeConfig;
import hr.agape.common.database.Jdbc;
import hr.agape.dispatch.config.DispatchDocumentConfig;
import hr.agape.dispatch.config.DispatchStornoDocumentConfig;
import hr.agape.document.domain.DocumentHeaderEntity;
import hr.agape.document.dto.DocumentItemLineDTO;
import hr.agape.document.lookup.view.DocumentSlotTypeView;
import hr.agape.document.repository.DocumentHeaderRepository;
import hr.agape.document.repository.DocumentLineRepository;
import hr.agape.document.repository.DocumentRepository;
import hr.agape.document.repository.DocumentTypeRepository;
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
    private final DocumentTypeRepository documentTypeRepository;
    private final AgapeConfig agapeConfig;
    private final Jdbc jdbc;

    @Inject
    public DispatchBookingTransactionService(
            DocumentHeaderRepository headerRepo,
            DocumentLineRepository lineRepo,
            DocumentRepository documentRepository,
            DispatchDocumentConfig dispatchDocumentConfig,
            DispatchStornoDocumentConfig dispatchStornoDocumentConfig,
            DocumentTypeRepository documentTypeRepository,
            AgapeConfig agapeConfig,
            Jdbc jdbc
    ) {
        this.headerRepo = headerRepo;
        this.lineRepo = lineRepo;
        this.documentRepository = documentRepository;
        this.dispatchDocumentConfig = dispatchDocumentConfig;
        this.dispatchStornoDocumentConfig = dispatchStornoDocumentConfig;
        this.documentTypeRepository = documentTypeRepository;
        this.agapeConfig = agapeConfig;
        this.jdbc = jdbc;
    }

    /**
     * Draft creation MUST be one Oracle session to match legacy behavior.
     * Also run RECALC to fill SD_STAVKE + SD_GLAVA computed fields (old app behavior).
     */
    public DocumentHeaderEntity createDraft(DocumentHeaderEntity headerInput, List<DocumentItemLineDTO> lines) throws SQLException {
        return jdbc.withConnection(c -> {
            boolean prevAuto = c.getAutoCommit();
            c.setAutoCommit(false);
            try {
                String operatorOibDigits = agapeConfig.operater().oib();

                documentRepository.initLegacyContext(c, headerInput.getDocumentId(), operatorOibDigits);

                DocumentHeaderEntity created = headerRepo.insert(c, headerInput);

                lineRepo.insert(c, created.getId(), lines);

                c.commit();
                return created;
            } catch (SQLException e) {
                try {
                    c.rollback();
                } catch (SQLException ignored) {
                }
                throw e;
            } finally {
                try {
                    c.setAutoCommit(prevAuto);
                } catch (SQLException ignored) {
                }
            }
        });
    }

    /**
     * REQUIRED:
     * Update draft lines + header in ONE TX.
     */
    public DocumentHeaderEntity updateDraft(Long headerId, Long partnerId, String note, List<DocumentItemLineDTO> newLines) throws SQLException {
        return jdbc.withConnection(c -> {
            boolean prevAuto = c.getAutoCommit();
            c.setAutoCommit(false);
            try {
                lineRepo.deleteByHeader(c, headerId);
                lineRepo.insert(c, headerId, newLines);

                DocumentHeaderEntity updated = headerRepo.updateDraftHeader(c, headerId, partnerId, note);
                if (updated == null) {
                    c.rollback();
                    return null;
                }

                c.commit();
                return updated;
            } catch (SQLException e) {
                try {
                    c.rollback();
                } catch (SQLException ignored) {
                }
                throw e;
            } finally {
                try {
                    c.setAutoCommit(prevAuto);
                } catch (SQLException ignored) {
                }
            }
        });
    }

    @Transactional(NOT_SUPPORTED)
    public void postViaProcedure(DocumentHeaderEntity documentHeaderEntity, String actorOibDigits) throws SQLException {
        String operatorOibDigits = agapeConfig.operater().oib();

        documentRepository.bookDocument(
                documentHeaderEntity.getId(),
                documentHeaderEntity.getDocumentId(),
                operatorOibDigits,
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
    public void cancelViaProcedure(Long headerId, Long actorOib,String cancelReason) throws SQLException {
        documentRepository.cancelDocument(
                headerId,
                dispatchStornoDocumentConfig.naSkladiste(),
                dispatchStornoDocumentConfig.ukPopisa(),
                dispatchStornoDocumentConfig.veznid(),
                dispatchStornoDocumentConfig.postaviOznaku()
        );

        headerRepo.setCancelledBy(headerId, actorOib);

        if (cancelReason != null && !cancelReason.isBlank()) {
            headerRepo.setCancelNote(headerId, cancelReason);
        }
    }

    public boolean deleteDraft(Long headerId) throws SQLException {
        return jdbc.withConnection(c -> {
            boolean prevAuto = c.getAutoCommit();
            c.setAutoCommit(false);

            try {
                final String lockSql = "SELECT 1 FROM SD_GLAVA WHERE ID = ? FOR UPDATE";
                try (var ps = c.prepareStatement(lockSql)) {
                    ps.setLong(1, headerId);
                    try (var rs = ps.executeQuery()) {
                        if (!rs.next()) {
                            c.rollback();
                            return false;
                        }
                    }
                }

                lineRepo.deleteByHeader(c, headerId);

                int deleted = headerRepo.deleteDraftHeader(c, headerId);

                if (deleted == 0) {
                    c.rollback();
                    return false;
                }

                c.commit();
                return true;

            } catch (SQLException e) {
                try { c.rollback(); } catch (SQLException ignored) {}
                throw e;
            } finally {
                try { c.setAutoCommit(prevAuto); } catch (SQLException ignored) {}
            }
        });
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
    @Deprecated
    public void postViaProcedure(DocumentHeaderEntity documentHeaderEntity, String actorOibDigits,
                                 @SuppressWarnings("unused") String a) throws SQLException {
        String operatorOibDigits = agapeConfig.operater().oib();

        DocumentSlotTypeView slot = documentTypeRepository.findDocumentSlot(documentHeaderEntity.getDocumentId())
                .orElseThrow(() -> new SQLException("Cannot post: unknown " +
                        "document slot DOKUMENT_ID=" + documentHeaderEntity.getDocumentId()));

        int knjizitiNaSkladiste = slot.getKnjizitiNaSkladiste();
        int knjizitiUkPopisa = slot.getKnjizitiUkPopisa();
        int knjizitiNormative = slot.getKnjizitiNormative();
        int generirajZapisnik = slot.getKnjizitiNormative();
        int azurirajProdajne = slot.getKnjizitiNormative();
        int azurirajNabavne = slot.getKnjizitiNormative();

        documentRepository.bookDocument(
                documentHeaderEntity.getId(),
                documentHeaderEntity.getDocumentId(),
                operatorOibDigits,
                actorOibDigits,
                knjizitiNaSkladiste,
                knjizitiUkPopisa,
                knjizitiNormative,
                generirajZapisnik,
                azurirajProdajne,
                azurirajNabavne
        );
    }
}
