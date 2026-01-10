package hr.agape.template.repository;

import hr.agape.template.domain.DispatchTemplateShareEntity;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class DispatchTemplateShareRepository implements PanacheRepository<DispatchTemplateShareEntity> {

    public List<DispatchTemplateShareEntity> listForTemplate(Long templateId) {
        return find("template.id = ?1 ORDER BY createdAt DESC, id DESC", templateId).list();
    }

    public DispatchTemplateShareEntity findByTemplateAndUser(Long templateId, Long userId) {
        return find("template.id = ?1 AND sharedWith.id = ?2", templateId, userId).firstResult();
    }

    public boolean existsByTemplateAndUser(Long templateId, Long userId) {
        return count("template.id = ?1 AND sharedWith.id = ?2", templateId, userId) > 0;
    }

    public List<Long> sharedTemplateIdsForUser(Long userId) {
        return find("SELECT s.template.id FROM DispatchTemplateShareEntity s WHERE s.sharedWith.id = ?1", userId)
                .project(Long.class)
                .list();
    }
}
