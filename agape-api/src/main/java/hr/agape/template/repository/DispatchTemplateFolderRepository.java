package hr.agape.template.repository;

import hr.agape.template.domain.DispatchTemplateFolderEntity;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;

import java.util.List;

@ApplicationScoped
public class DispatchTemplateFolderRepository implements PanacheRepository<DispatchTemplateFolderEntity> {

    @PersistenceContext
    EntityManager em;

    public long countChildren(Long ownerUserId, Long parentId, String q) {
        StringBuilder jpql = new StringBuilder("""
                SELECT COUNT(f.id)
                FROM DispatchTemplateFolderEntity f
                WHERE f.owner.id = :ownerUserId
                """);

        if (parentId == null) {
            jpql.append(" AND f.parent IS NULL ");
        } else {
            jpql.append(" AND f.parent.id = :parentId ");
        }

        if (q != null && !q.isBlank()) {
            jpql.append(" AND LOWER(COALESCE(f.name, '')) LIKE :q ");
        }

        TypedQuery<Long> query = em.createQuery(jpql.toString(), Long.class)
                .setParameter("ownerUserId", ownerUserId);

        if (parentId != null) {
            query.setParameter("parentId", parentId);
        }

        if (q != null && !q.isBlank()) {
            query.setParameter("q", "%" + q.trim().toLowerCase() + "%");
        }

        return query.getSingleResult();
    }

    public List<DispatchTemplateFolderEntity> pageChildren(Long ownerUserId, Long parentId, String q, int page, int size) {
        StringBuilder jpql = new StringBuilder("""
                SELECT f
                FROM DispatchTemplateFolderEntity f
                LEFT JOIN FETCH f.parent
                WHERE f.owner.id = :ownerUserId
                """);

        if (parentId == null) {
            jpql.append(" AND f.parent IS NULL ");
        } else {
            jpql.append(" AND f.parent.id = :parentId ");
        }

        if (q != null && !q.isBlank()) {
            jpql.append(" AND LOWER(COALESCE(f.name, '')) LIKE :q ");
        }

        jpql.append(" ORDER BY LOWER(COALESCE(f.name, '')) ASC, f.id ASC ");

        TypedQuery<DispatchTemplateFolderEntity> query = em.createQuery(
                jpql.toString(),
                DispatchTemplateFolderEntity.class
        ).setParameter("ownerUserId", ownerUserId);

        if (parentId != null) {
            query.setParameter("parentId", parentId);
        }

        if (q != null && !q.isBlank()) {
            query.setParameter("q", "%" + q.trim().toLowerCase() + "%");
        }

        query.setFirstResult(page * size);
        query.setMaxResults(size);

        return query.getResultList();
    }

    public List<DispatchTemplateFolderEntity> listChildren(Long ownerUserId, Long parentId, String q) {
        StringBuilder jpql = new StringBuilder("""
                SELECT f
                FROM DispatchTemplateFolderEntity f
                LEFT JOIN FETCH f.parent
                WHERE f.owner.id = :ownerUserId
                """);

        if (parentId == null) {
            jpql.append(" AND f.parent IS NULL ");
        } else {
            jpql.append(" AND f.parent.id = :parentId ");
        }

        if (q != null && !q.isBlank()) {
            jpql.append(" AND LOWER(COALESCE(f.name, '')) LIKE :q ");
        }

        jpql.append(" ORDER BY LOWER(COALESCE(f.name, '')) ASC, f.id ASC ");

        TypedQuery<DispatchTemplateFolderEntity> query = em.createQuery(
                jpql.toString(),
                DispatchTemplateFolderEntity.class
        ).setParameter("ownerUserId", ownerUserId);

        if (parentId != null) {
            query.setParameter("parentId", parentId);
        }

        if (q != null && !q.isBlank()) {
            query.setParameter("q", "%" + q.trim().toLowerCase() + "%");
        }

        return query.getResultList();
    }

    public List<DispatchTemplateFolderEntity> listRootChildren(Long ownerUserId, String q) {
        return listChildren(ownerUserId, null, q);
    }

    public List<DispatchTemplateFolderEntity> listTreeForOwner(Long ownerUserId) {
        return find("""
                SELECT f
                FROM DispatchTemplateFolderEntity f
                LEFT JOIN FETCH f.parent
                WHERE f.owner.id = ?1
                ORDER BY
                    CASE WHEN f.parent IS NULL THEN 0 ELSE 1 END,
                    LOWER(COALESCE(f.name, '')),
                    f.id
                """, ownerUserId)
                .list();
    }

    public List<DispatchTemplateFolderEntity> listForOwner(Long ownerUserId) {
        return find("owner.id = ?1", ownerUserId).list();
    }

    public DispatchTemplateFolderEntity findOwned(Long folderId, Long ownerUserId) {
        return find("id = ?1 and owner.id = ?2", folderId, ownerUserId).firstResult();
    }

    public boolean doesNotBelongToOwner(Long folderId, Long ownerUserId) {
        return count("id = ?1 and owner.id = ?2", folderId, ownerUserId) == 0;
    }

    public List<String> listChildNames(Long ownerUserId, Long parentId) {
        if (parentId == null) {
            return em.createQuery(
                            "select f.name from DispatchTemplateFolderEntity f " +
                                    "where f.owner.id = ?1 and f.parent is null",
                            String.class
                    )
                    .setParameter(1, ownerUserId)
                    .getResultList();
        }

        return em.createQuery(
                        "select f.name from DispatchTemplateFolderEntity f " +
                                "where f.owner.id = ?1 and f.parent.id = ?2",
                        String.class
                )
                .setParameter(1, ownerUserId)
                .setParameter(2, parentId)
                .getResultList();
    }

    public List<String> listChildNamesExcluding(Long ownerUserId, Long parentId, Long excludeFolderId) {
        if (excludeFolderId == null) return listChildNames(ownerUserId, parentId);

        if (parentId == null) {
            return em.createQuery(
                            "select f.name from DispatchTemplateFolderEntity f " +
                                    "where f.owner.id = ?1 and f.parent is null and f.id <> ?2",
                            String.class
                    )
                    .setParameter(1, ownerUserId)
                    .setParameter(2, excludeFolderId)
                    .getResultList();
        }

        return em.createQuery(
                        "select f.name from DispatchTemplateFolderEntity f " +
                                "where f.owner.id = ?1 and f.parent.id = ?2 and f.id <> ?3",
                        String.class
                )
                .setParameter(1, ownerUserId)
                .setParameter(2, parentId)
                .setParameter(3, excludeFolderId)
                .getResultList();
    }

    public long countChildren(Long ownerUserId, Long parentId) {
        return countChildren(ownerUserId, parentId, null);
    }

    public List<DispatchTemplateFolderEntity> pageChildren(Long ownerUserId, Long parentId, int page, int size) {
        return pageChildren(ownerUserId, parentId, null, page, size);
    }
}