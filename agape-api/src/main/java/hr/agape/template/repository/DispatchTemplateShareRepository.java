package hr.agape.template.repository;

import hr.agape.template.domain.DispatchTemplateShareEntity;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import io.quarkus.panache.common.Page;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class DispatchTemplateShareRepository implements PanacheRepository<DispatchTemplateShareEntity> {

    public List<DispatchTemplateShareEntity> listForTemplate(Long templateId) {
        return find("template.id = ?1 ORDER BY createdAt DESC, id DESC", templateId).list();
    }

    public long countForTemplate(Long templateId) {
        return count("template.id = ?1", templateId);
    }

    public List<DispatchTemplateShareEntity> pageForTemplate(Long templateId, int page, int size) {
        return find("""
                SELECT s
                FROM DispatchTemplateShareEntity s
                JOIN FETCH s.sharedWith
                WHERE s.template.id = ?1
                ORDER BY s.createdAt DESC, s.id DESC
                """, templateId)
                .page(Page.of(page, size))
                .list();
    }

    public DispatchTemplateShareEntity findByTemplateAndUser(Long templateId, Long userId) {
        return find("template.id = ?1 AND sharedWith.id = ?2", templateId, userId).firstResult();
    }

    public boolean existsByTemplateAndUser(Long templateId, Long userId) {
        return count("template.id = ?1 AND sharedWith.id = ?2", templateId, userId) > 0;
    }

    public List<DispatchTemplateShareEntity> listForSharedWith(Long userId) {
        return find("sharedWith.id = ?1", userId).list();
    }
}