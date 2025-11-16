package hr.agape.user.converter;

import hr.agape.common.constant.Roles;
import hr.agape.user.enumeration.Role;

public final class RoleConverter {

    private RoleConverter() {}

    public static String toString(Role role) {
        return switch (role) {
            case USER -> Roles.USER;
            case ADMIN -> Roles.ADMIN;
        };
    }

    public static Role fromString(String value) {
        return Role.valueOf(value);
    }
}
