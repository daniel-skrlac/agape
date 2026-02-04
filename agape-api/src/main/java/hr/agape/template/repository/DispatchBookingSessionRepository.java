package hr.agape.template.repository;

import hr.agape.template.domain.DispatchBookingSessionEntity;
import hr.agape.template.enumeration.BookingSessionStatus;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class DispatchBookingSessionRepository implements PanacheRepository<DispatchBookingSessionEntity> {

    public DispatchBookingSessionEntity findOwned(Long id, Long ownerUserId) {
        return find("id = ?1 and owner.id = ?2", id, ownerUserId).firstResult();
    }

    public List<DispatchBookingSessionEntity> listForOwner(Long ownerUserId) {
        return find("owner.id = ?1 order by id desc", ownerUserId).list();
    }

    public List<DispatchBookingSessionEntity> listForOwnerByStatus(Long ownerUserId, BookingSessionStatus status) {
        return find("owner.id = ?1 and status = ?2 order by id desc", ownerUserId, status).list();
    }
}
