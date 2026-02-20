package hr.agape.template.repository;

import hr.agape.template.domain.DispatchTemplateDocEntity;
import hr.agape.template.domain.DispatchTemplateEntity;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;

import java.util.Collection;
import java.util.List;

@ApplicationScoped
public class DispatchTemplateRepository implements PanacheRepository<DispatchTemplateEntity> {

    @Inject
    EntityManager em;

    public boolean isOwnedBy(Long templateId, Long ownerUserId) {
        return count("id = ?1 AND owner.id = ?2", templateId, ownerUserId) > 0;
    }

    public boolean isNotOwnedBy(Long templateId, Long ownerUserId) {
        return !isOwnedBy(templateId, ownerUserId);
    }

    public DispatchTemplateEntity findOwned(Long templateId, Long ownerUserId) {
        return find("id = ?1 AND owner.id = ?2", templateId, ownerUserId)
                .singleResultOptional()
                .orElse(null);
    }

    public List<DispatchTemplateEntity> listWithDocsByOwnerAndFolder(Long ownerUserId, Long folderId) {
        return em.createQuery("""
                        SELECT DISTINCT t
                        FROM DispatchTemplateEntity t
                        LEFT JOIN FETCH t.documents d
                        WHERE t.owner.id = :ownerId
                          AND (
                                (:folderId IS NULL AND t.folder IS NULL)
                                OR (t.folder.id = :folderId)
                          )
                        ORDER BY t.id ASC
                        """, DispatchTemplateEntity.class)
                .setParameter("ownerId", ownerUserId)
                .setParameter("folderId", folderId)
                .getResultList();
    }

    public void loadDocItemsForTemplates(Collection<Long> templateIds) {
        if (templateIds == null || templateIds.isEmpty()) return;

        em.createQuery("""
                        SELECT DISTINCT d
                        FROM DispatchTemplateDocEntity d
                        LEFT JOIN FETCH d.items i
                        WHERE d.template.id IN :templateIds
                        """, DispatchTemplateDocEntity.class)
                .setParameter("templateIds", templateIds)
                .getResultList();
    }

    public boolean existsOwnedDoc(Long templateId, Long templateDocId, Long ownerUserId) {
        Long cnt = em.createQuery("""
                        SELECT COUNT(d.id)
                        FROM DispatchTemplateDocEntity d
                        WHERE d.id = :docId
                          AND d.template.id = :templateId
                          AND d.template.owner.id = :ownerId
                        """, Long.class)
                .setParameter("docId", templateDocId)
                .setParameter("templateId", templateId)
                .setParameter("ownerId", ownerUserId)
                .getSingleResult();

        return cnt != null && cnt > 0;
    }

    public List<String> listNamesForOwnerAndFolder(Long ownerUserId, Long folderId, Long excludeTemplateId) {
        if (folderId == null) {
            if (excludeTemplateId == null) {
                return find("SELECT t.name FROM DispatchTemplateEntity t WHERE t.owner.id = ?1 AND t.folder IS NULL", ownerUserId)
                        .project(String.class).list();
            }
            return find("SELECT t.name FROM DispatchTemplateEntity t WHERE t.owner.id = ?1 AND t.folder IS NULL AND t.id <> ?2",
                    ownerUserId, excludeTemplateId)
                    .project(String.class).list();
        }

        if (excludeTemplateId == null) {
            return find("SELECT t.name FROM DispatchTemplateEntity t WHERE t.owner.id = ?1 AND t.folder.id = ?2",
                    ownerUserId, folderId)
                    .project(String.class).list();
        }

        return find("SELECT t.name FROM DispatchTemplateEntity t WHERE t.owner.id = ?1 AND t.folder.id = ?2 AND t.id <> ?3",
                ownerUserId, folderId, excludeTemplateId)
                .project(String.class).list();
    }

    public DispatchTemplateEntity findFull(Long templateId, Long ownerUserId) {
        return find("""
                SELECT DISTINCT t
                FROM DispatchTemplateEntity t
                LEFT JOIN FETCH t.documents d
                LEFT JOIN FETCH d.items i
                WHERE t.id = ?1
                  AND t.owner.id = ?2
                """, templateId, ownerUserId)
                .singleResultOptional()
                .orElse(null);
    }

    public DispatchTemplateEntity findFullAccessible(Long templateId, Long userId) {
        return find("""
                SELECT DISTINCT t
                FROM DispatchTemplateEntity t
                LEFT JOIN FETCH t.documents d
                LEFT JOIN FETCH d.items i
                WHERE t.id = ?1
                  AND (
                        t.owner.id = ?2
                        OR EXISTS (
                            SELECT 1
                            FROM DispatchTemplateShareEntity s
                            WHERE s.template = t
                              AND s.sharedWith.id = ?2
                        )
                  )
                """, templateId, userId)
                .singleResultOptional()
                .orElse(null);
    }

    public List<DispatchTemplateEntity> listSharedHeaders(Long userId, String q) {
        String order = " ORDER BY t.householdSize ASC, LOWER(t.name) ASC, t.id DESC";

        if (q == null || q.isBlank()) {
            return find("""
                    SELECT t FROM DispatchTemplateEntity t
                    WHERE EXISTS (
                        SELECT 1 FROM DispatchTemplateShareEntity s
                        WHERE s.template = t AND s.sharedWith.id = ?1
                    )
                    """ + order, userId).list();
        }

        String like = "%" + q.toLowerCase().trim() + "%";
        return find("""
                SELECT t FROM DispatchTemplateEntity t
                WHERE EXISTS (
                    SELECT 1 FROM DispatchTemplateShareEntity s
                    WHERE s.template = t AND s.sharedWith.id = ?1
                )
                  AND LOWER(t.name) LIKE ?2
                """ + order, userId, like).list();
    }

    public List<DispatchTemplateEntity> listFullAccessibleByIds(Long userId, Collection<Long> templateIds) {
        if (templateIds == null || templateIds.isEmpty()) {
            return List.of();
        }

        return em.createQuery("""
                        SELECT DISTINCT t
                        FROM DispatchTemplateEntity t
                        LEFT JOIN FETCH t.documents d
                        LEFT JOIN FETCH d.items i
                        WHERE t.id IN :templateIds
                          AND (
                                t.owner.id = :userId
                                OR EXISTS (
                                    SELECT 1
                                    FROM DispatchTemplateShareEntity s
                                    WHERE s.template = t
                                      AND s.sharedWith.id = :userId
                                )
                          )
                        """, DispatchTemplateEntity.class)
                .setParameter("templateIds", templateIds)
                .setParameter("userId", userId)
                .getResultList();
    }

    public List<DispatchTemplateEntity> listHeaders(Long ownerUserId, Long folderId, String q, Boolean rootOnly) {
        String base = "owner.id = ?1";
        String order = " ORDER BY householdSize ASC, LOWER(name) ASC, id DESC";

        boolean isRootOnly = Boolean.TRUE.equals(rootOnly);
        boolean hasFolder = folderId != null;
        boolean hasQ = q != null && !q.isBlank();

        if (hasFolder) {
            if (!hasQ) {
                return find(base + " AND folder.id = ?2" + order, ownerUserId, folderId).list();
            }
            String like = "%" + q.toLowerCase().trim() + "%";
            return find(base + " AND folder.id = ?2 AND LOWER(name) LIKE ?3" + order, ownerUserId, folderId, like).list();
        }

        if (isRootOnly) {
            if (!hasQ) {
                return find(base + " AND folder IS NULL" + order, ownerUserId).list();
            }
            String like = "%" + q.toLowerCase().trim() + "%";
            return find(base + " AND folder IS NULL AND LOWER(name) LIKE ?2" + order, ownerUserId, like).list();
        }

        if (!hasQ) {
            return find(base + order, ownerUserId).list();
        }
        String like = "%" + q.toLowerCase().trim() + "%";
        return find(base + " AND LOWER(name) LIKE ?2" + order, ownerUserId, like).list();
    }

    public boolean existsDocWithDocumentId(Long templateId, Long documentId, Long excludeDocId) {
        if (excludeDocId == null) {
            return DispatchTemplateDocEntity.count(
                    "template.id = ?1 and documentId = ?2",
                    templateId, documentId
            ) > 0;
        }
        return DispatchTemplateDocEntity.count(
                "template.id = ?1 and documentId = ?2 and id <> ?3",
                templateId, documentId, excludeDocId
        ) > 0;
    }
}
