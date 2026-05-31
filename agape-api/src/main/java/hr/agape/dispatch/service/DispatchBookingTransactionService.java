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
import hr.agape.document.repository.LegacyBookingPreparationRepository;
import hr.agape.document.repository.LegacyDocumentHeaderNormalizerRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

import static jakarta.transaction.Transactional.TxType.NOT_SUPPORTED;

@ApplicationScoped
public class DispatchBookingTransactionService {

    private final DocumentHeaderRepository headerRepo;
    private final DocumentLineRepository lineRepo;
    private final DocumentRepository documentRepository;
    private final LegacyBookingPreparationRepository legacyBookingPreparationRepository;
    private final LegacyDocumentHeaderNormalizerRepository legacyDocumentHeaderNormalizerRepository;
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
            LegacyBookingPreparationRepository legacyBookingPreparationRepository,
            LegacyDocumentHeaderNormalizerRepository legacyDocumentHeaderNormalizerRepository,
            DispatchDocumentConfig dispatchDocumentConfig,
            DispatchStornoDocumentConfig dispatchStornoDocumentConfig,
            DocumentTypeRepository documentTypeRepository,
            AgapeConfig agapeConfig,
            Jdbc jdbc
    ) {
        this.headerRepo = headerRepo;
        this.lineRepo = lineRepo;
        this.documentRepository = documentRepository;
        this.legacyBookingPreparationRepository = legacyBookingPreparationRepository;
        this.legacyDocumentHeaderNormalizerRepository = legacyDocumentHeaderNormalizerRepository;
        this.dispatchDocumentConfig = dispatchDocumentConfig;
        this.dispatchStornoDocumentConfig = dispatchStornoDocumentConfig;
        this.documentTypeRepository = documentTypeRepository;
        this.agapeConfig = agapeConfig;
        this.jdbc = jdbc;
    }

    public DocumentHeaderEntity createDraft(
            DocumentHeaderEntity headerInput,
            List<DocumentItemLineDTO> lines
    ) throws SQLException {
        return jdbc.withConnection(c -> {
            boolean previousAutoCommit = c.getAutoCommit();
            c.setAutoCommit(false);

            try {
                String operatorOibDigits = agapeConfig.operater().oib();

                documentRepository.initLegacyContext(c, headerInput.getDocumentId(), operatorOibDigits);

                DocumentHeaderEntity created = headerRepo.insert(c, headerInput);
                lineRepo.insert(c, created.getId(), lines);

                legacyBookingPreparationRepository.prepareDraftForBooking(c, created.getId());
                legacyDocumentHeaderNormalizerRepository.normalizeDispatchHeader(c, created.getId());

                DocumentHeaderEntity prepared = headerRepo.findHeader(c, created.getId());

                c.commit();
                return prepared != null ? prepared : created;
            } catch (SQLException e) {
                rollbackQuietly(c);
                throw e;
            } finally {
                restoreAutoCommitQuietly(c, previousAutoCommit);
            }
        });
    }

    public DocumentHeaderEntity updateDraft(
            Long headerId,
            Long partnerId,
            String note,
            List<DocumentItemLineDTO> newLines
    ) throws SQLException {
        return jdbc.withConnection(c -> {
            boolean previousAutoCommit = c.getAutoCommit();
            c.setAutoCommit(false);

            try {
                DocumentHeaderEntity existing = headerRepo.findHeader(c, headerId);
                if (existing == null || Boolean.TRUE.equals(existing.getPosted())) {
                    rollbackQuietly(c);
                    return null;
                }

                String operatorOibDigits = agapeConfig.operater().oib();

                documentRepository.initLegacyContext(c, existing.getDocumentId(), operatorOibDigits);

                lineRepo.deleteByHeader(c, headerId);
                lineRepo.insert(c, headerId, newLines);

                DocumentHeaderEntity updated = headerRepo.updateDraftHeader(c, headerId, partnerId, note);
                if (updated == null) {
                    rollbackQuietly(c);
                    return null;
                }

                legacyBookingPreparationRepository.prepareDraftForBooking(c, headerId);
                legacyDocumentHeaderNormalizerRepository.normalizeDispatchHeader(c, headerId);

                DocumentHeaderEntity prepared = headerRepo.findHeader(c, headerId);

                c.commit();
                return prepared != null ? prepared : updated;
            } catch (SQLException e) {
                rollbackQuietly(c);
                throw e;
            } finally {
                restoreAutoCommitQuietly(c, previousAutoCommit);
            }
        });
    }

    @Transactional(NOT_SUPPORTED)
    public void postViaProcedure(DocumentHeaderEntity documentHeaderEntity, String actorOibDigits) throws SQLException {
        if (documentHeaderEntity == null || documentHeaderEntity.getId() == null) {
            throw new SQLException("Cannot post: missing SD_GLAVA header.");
        }

        if (documentHeaderEntity.getDocumentId() == null) {
            throw new SQLException("Cannot post: missing DOKUMENT_ID. SD_GLAVA.ID=" + documentHeaderEntity.getId());
        }

        String operatorOibDigits = agapeConfig.operater().oib();
        String bookingOibDigits = firstNonBlank(actorOibDigits, operatorOibDigits);

        DocumentSlotTypeView slot = documentTypeRepository.findDocumentSlot(documentHeaderEntity.getDocumentId())
                .orElseThrow(() -> new SQLException(
                        "Cannot post: unknown document slot DOKUMENT_ID=" + documentHeaderEntity.getDocumentId()
                ));

        jdbc.withConnectionVoid(c -> {
            boolean previousAutoCommit = c.getAutoCommit();
            c.setAutoCommit(false);

            try {
                documentRepository.initLegacyContext(c, documentHeaderEntity.getDocumentId(), bookingOibDigits);

                /*
                 * Always prepare before posting. This also repairs old drafts that were created
                 * before the preparation code existed.
                 */
                legacyBookingPreparationRepository.prepareDraftForBooking(c, documentHeaderEntity.getId());
                legacyDocumentHeaderNormalizerRepository.normalizeDispatchHeader(c, documentHeaderEntity.getId());

                documentRepository.bookDocument(
                        c,
                        documentHeaderEntity.getId(),
                        documentHeaderEntity.getDocumentId(),
                        bookingOibDigits,
                        bookingOibDigits,
                        nz(slot.getKnjizitiNaSkladiste()),
                        nz(slot.getKnjizitiUkPopisa()),
                        nz(slot.getKnjizitiNormative()),
                        dispatchDocumentConfig.generirajZapisnik(),
                        dispatchDocumentConfig.azurirajProdajne(),
                        dispatchDocumentConfig.azurirajNabavne()
                );

                /*
                 * KNJIZI_MK_DOKUMENT commits internally. This final step only applies safe,
                 * non-business normalization that does not override legacy totals.
                 */
                legacyDocumentHeaderNormalizerRepository.normalizeDispatchHeader(c, documentHeaderEntity.getId());

                c.commit();
            } catch (SQLException e) {
                rollbackQuietly(c);
                throw e;
            } finally {
                restoreAutoCommitQuietly(c, previousAutoCommit);
            }
        });
    }

    @Transactional(NOT_SUPPORTED)
    public void cancelViaProcedure(Long headerId, Long actorOib, String cancelReason) throws SQLException {
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
            boolean previousAutoCommit = c.getAutoCommit();
            c.setAutoCommit(false);

            try {
                final String lockSql = "SELECT 1 FROM SD_GLAVA WHERE ID = ? FOR UPDATE NOWAIT";
                try (var ps = c.prepareStatement(lockSql)) {
                    ps.setLong(1, headerId);
                    try (var rs = ps.executeQuery()) {
                        if (!rs.next()) {
                            rollbackQuietly(c);
                            return false;
                        }
                    }
                }

                lineRepo.deleteByHeader(c, headerId);
                int deleted = headerRepo.deleteDraftHeader(c, headerId);

                if (deleted == 0) {
                    rollbackQuietly(c);
                    return false;
                }

                c.commit();
                return true;
            } catch (SQLException e) {
                rollbackQuietly(c);
                throw e;
            } finally {
                restoreAutoCommitQuietly(c, previousAutoCommit);
            }
        });
    }

    @Deprecated
    @Transactional(Transactional.TxType.REQUIRED)
    public DocumentHeaderEntity cancelPosted(Long headerId, Long actorOib, String reason) throws SQLException {
        return headerRepo.cancelDispatch(headerId, actorOib, reason);
    }

    private static String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        return second;
    }

    private static int nz(Integer value) {
        return value != null ? value : 0;
    }

    private static void rollbackQuietly(Connection c) {
        try {
            c.rollback();
        } catch (SQLException ignored) {
        }
    }

    private static void restoreAutoCommitQuietly(Connection c, boolean previousAutoCommit) {
        try {
            c.setAutoCommit(previousAutoCommit);
        } catch (SQLException ignored) {
        }
    }
}
