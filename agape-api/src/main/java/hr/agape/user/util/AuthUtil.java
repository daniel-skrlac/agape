package hr.agape.user.util;

import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.Set;
import java.util.stream.Collectors;

@RequestScoped
public class AuthUtil {

    private final JsonWebToken jwt;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public AuthUtil(JsonWebToken jwt) {
        this.jwt = jwt;
    }

    public String requireOibDigits() {
        String oib = getOibDigits();
        if (oib == null) {
            throw new IllegalStateException("Cannot resolve OIB from security context (JWT claim 'oib').");
        }
        return oib;
    }

    public Long requireOibAsLong() {
        String digits = requireOibDigits();
        return Long.valueOf(digits);
    }

    public String getOibDigits() {
        if (jwt == null) return null;

        Object claim = jwt.getClaim("oib");
        String raw = null;

        if (claim instanceof Number n) raw = String.valueOf(n.longValue());
        else if (claim instanceof String s) raw = s;

        if (raw == null) return null;

        String digits = raw.replaceAll("[^0-9]", "");
        if (digits.length() != 11) {
            throw new IllegalStateException("Invalid OIB in JWT. Expected 11 digits, got: '" + raw + "'");
        }
        return digits;
    }

    public Long requireUserId() {
        Long id = getUserId();
        if (id == null) {
            throw new IllegalStateException("Cannot resolve current user from security context.");
        }
        return id;
    }

    public Long getUserId() {
        if (jwt == null) return null;

        Object claim = jwt.getClaim("userId");
        if (claim instanceof Number) return ((Number) claim).longValue();
        if (claim instanceof String) {
            try {
                return Long.valueOf((String) claim);
            } catch (NumberFormatException ignored) {
            }
        }

        String sub = jwt.getSubject();
        if (sub != null) {
            try {
                return Long.valueOf(sub);
            } catch (NumberFormatException ignored) {
            }
        }
        return null;
    }

    public String getUsername() {
        return jwt == null ? null : jwt.getName();
    }

    public Set<String> getRoles() {
        if (jwt == null) return Set.of();
        return jwt.getGroups() == null ? Set.of() : jwt.getGroups().stream().collect(Collectors.toUnmodifiableSet());
    }

    public boolean hasRole(String role) {
        return getRoles().contains(role);
    }
}
