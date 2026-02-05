package hr.agape.template.repository;

import hr.agape.template.domain.DispatchTemplateDocEntity;
import hr.agape.template.domain.DispatchTemplateEntity;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;

import java.time.OffsetDateTime;
import java.util.List;

@ApplicationScoped
public class DispatchTemplateRepository implements PanacheRepository<DispatchTemplateEntity> {

    @Inject
    EntityManager em;

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

    public int touchUpdatedAt(Long templateId, OffsetDateTime now) {
        return em.createQuery("""
                UPDATE DispatchTemplateEntity t
                SET t.updatedAt = :now
                WHERE t.id = :id
                """)
                .setParameter("now", now)
                .setParameter("id", templateId)
                .executeUpdate();
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

    public List<DispatchTemplateEntity> listByOwnerAndFolder(Long ownerUserId, Long folderId) {
        return find("owner.id = ?1 AND folder.id = ?2 ORDER BY id ASC", ownerUserId, folderId).list();
    }

    public DispatchTemplateEntity findFull(Long templateId, Long ownerUserId) {

        DispatchTemplateEntity t = find("""
                SELECT DISTINCT t
                FROM DispatchTemplateEntity t
                LEFT JOIN FETCH t.documents d
                WHERE t.id = ?1
                  AND t.owner.id = ?2
                """, templateId, ownerUserId)
                .singleResultOptional()
                .orElse(null);

        if (t == null) return null;

        find("""
                SELECT DISTINCT d
                FROM DispatchTemplateDocEntity d
                LEFT JOIN FETCH d.items i
                WHERE d.template.id = ?1
                """, templateId).list();

        return t;
    }

    public DispatchTemplateEntity findFullAccessible(Long templateId, Long userId) {

        DispatchTemplateEntity t = find("""
                SELECT DISTINCT t
                FROM DispatchTemplateEntity t
                LEFT JOIN FETCH t.documents d
                LEFT JOIN t.shares s
                WHERE t.id = ?1
                  AND (t.owner.id = ?2 OR s.sharedWith.id = ?2)
                """, templateId, userId)
                .singleResultOptional()
                .orElse(null);

        if (t == null) return null;

        find("""
                SELECT DISTINCT d
                FROM DispatchTemplateDocEntity d
                LEFT JOIN FETCH d.items i
                WHERE d.template.id = ?1
                """, templateId).list();

        return t;
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
