package hr.agape.user.repository;

import hr.agape.user.domain.RoleEntity;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class RoleRepository implements PanacheRepository<RoleEntity> {

    public RoleEntity findByName(String name) {
        return find("LOWER(name) = LOWER(?1)", name)
                .firstResult();
    }

    public boolean existsByName(String name) {
        return count("LOWER(name) = LOWER(?1)", name) > 0;
    }
}
