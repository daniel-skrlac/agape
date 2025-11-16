package hr.agape.user.repository;

import hr.agape.user.domain.UserEntity;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class UserRepository implements PanacheRepository<UserEntity> {

    public UserEntity findByUsername(String username) {
        return find("LOWER(username) = LOWER(?1)", username)
                .firstResult();
    }

    public boolean existsByUsername(String username) {
        return count("LOWER(username) = LOWER(?1)", username) > 0;
    }
}
