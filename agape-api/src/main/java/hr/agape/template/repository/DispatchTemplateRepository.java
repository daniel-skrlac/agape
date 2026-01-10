package hr.agape.template.repository;

import hr.agape.template.domain.DispatchTemplateEntity;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class DispatchTemplateRepository implements PanacheRepository<DispatchTemplateEntity> {

    public DispatchTemplateEntity findFull(Long templateId, Long ownerUserId) {
        return find("""
                SELECT DISTINCT t FROM DispatchTemplateEntity t
                LEFT JOIN FETCH t.documents d
                LEFT JOIN FETCH d.items i
                WHERE t.id = ?1 AND t.owner.id = ?2
                """, templateId, ownerUserId).firstResult();
    }

    public DispatchTemplateEntity findFullAccessible(Long templateId, Long userId) {
        return find("""
                SELECT DISTINCT t FROM DispatchTemplateEntity t
                LEFT JOIN FETCH t.documents d
                LEFT JOIN FETCH d.items i
                LEFT JOIN t.shares s
                WHERE t.id = ?1 AND (t.owner.id = ?2 OR s.sharedWith.id = ?2)
                """, templateId, userId).firstResult();
    }

    public List<DispatchTemplateEntity> listSharedHeaders(Long userId, String q) {
        String order = " ORDER BY t.householdSize ASC, LOWER(t.name) ASC, t.id DESC";

        if (q == null || q.isBlank()) {
            return find("""
                    SELECT DISTINCT t FROM DispatchTemplateEntity t
                    JOIN t.shares s
                    WHERE s.sharedWith.id = ?1
                    """ + order, userId).list();
        }

        String like = "%" + q.toLowerCase().trim() + "%";
        return find("""
                SELECT DISTINCT t FROM DispatchTemplateEntity t
                JOIN t.shares s
                WHERE s.sharedWith.id = ?1 AND LOWER(t.name) LIKE ?2
                """ + order, userId, like).list();
    }

    public List<DispatchTemplateEntity> listHeaders(Long ownerUserId, Long folderId, String q) {
        String base = "owner.id = ?1";
        String order = " ORDER BY householdSize ASC, LOWER(name) ASC, id DESC";

        if (folderId == null && (q == null || q.isBlank())) {
            return find(base + " AND folder IS NULL" + order, ownerUserId).list();
        }
        if (folderId != null && (q == null || q.isBlank())) {
            return find(base + " AND folder.id = ?2" + order, ownerUserId, folderId).list();
        }
        String like = "%" + q.toLowerCase().trim() + "%";
        if (folderId == null) {
            return find(base + " AND folder IS NULL AND LOWER(name) LIKE ?2" + order, ownerUserId, like).list();
        }
        return find(base + " AND folder.id = ?2 AND LOWER(name) LIKE ?3" + order, ownerUserId, folderId, like).list();
    }
}
