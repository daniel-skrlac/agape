package hr.agape.template.repository;

import hr.agape.template.domain.DispatchBookingSessionEntity;
import hr.agape.template.enumeration.BookingSessionStatus;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import io.quarkus.panache.common.Page;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class DispatchBookingSessionRepository implements PanacheRepository<DispatchBookingSessionEntity> {

    public DispatchBookingSessionEntity findOwned(Long id, Long ownerUserId) {
        return find("id = ?1 and owner.id = ?2", id, ownerUserId).firstResult();
    }

    public long countForOwner(Long ownerUserId) {
        return count("owner.id = ?1", ownerUserId);
    }

    public long countForOwnerByStatus(Long ownerUserId, BookingSessionStatus status) {
        return count("owner.id = ?1 and status = ?2", ownerUserId, status);
    }

    public List<DispatchBookingSessionEntity> pageForOwner(Long ownerUserId, int page, int size) {
        return find("owner.id = ?1 order by id desc", ownerUserId)
                .page(Page.of(page, size))
                .list();
    }

    public List<DispatchBookingSessionEntity> pageForOwnerByStatus(Long ownerUserId, BookingSessionStatus status,
                                                                   int page, int size) {
        return find("owner.id = ?1 and status = ?2 order by id desc", ownerUserId, status)
                .page(Page.of(page, size))
                .list();
    }
}