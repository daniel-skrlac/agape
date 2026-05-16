package hr.agape.item.util;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Objects;

public final class ItemCodeUtil {

    private static final int DEFAULT_NUMERIC_CODE_LENGTH = 4;

    private ItemCodeUtil() {
    }

    public static List<String> cleanCodes(Collection<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return List.of();
        }

        return codes.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(x -> !x.isBlank())
                .map(String::toUpperCase)
                .distinct()
                .toList();
    }

    public static List<String> numericCodes(Collection<String> codes) {
        return cleanCodes(codes).stream()
                .filter(ItemCodeUtil::isNumeric)
                .map(ItemCodeUtil::normalize)
                .distinct()
                .toList();
    }

    public static List<String> paddedNumericCodes(Collection<String> codes) {
        return numericCodes(codes).stream()
                .map(ItemCodeUtil::padNumericCode)
                .distinct()
                .toList();
    }

    public static String normalize(String code) {
        if (code == null) {
            return "";
        }

        String trimmed = code.trim().toUpperCase();

        if (isNumeric(trimmed)) {
            return trimmed.replaceFirst("^0+(?!$)", "");
        }

        return trimmed;
    }

    public static String padNumericCode(String code) {
        String normalized = normalize(code);

        if (!isNumeric(normalized)) {
            return normalized;
        }

        if (normalized.length() >= DEFAULT_NUMERIC_CODE_LENGTH) {
            return normalized;
        }

        return "0".repeat(DEFAULT_NUMERIC_CODE_LENGTH - normalized.length()) + normalized;
    }

    public static List<String> aliasesFor(String itemCode, Long itemId) {
        List<String> aliases = new ArrayList<>();

        if (itemCode != null && !itemCode.isBlank()) {
            aliases.add(normalize(itemCode));
        }

        if (itemId != null) {
            aliases.add(normalize(String.valueOf(itemId)));
            aliases.add(normalize(padNumericCode(String.valueOf(itemId))));
        }

        return aliases.stream()
                .filter(x -> !x.isBlank())
                .distinct()
                .toList();
    }

    public static String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first.trim();
        }

        if (second != null && !second.isBlank()) {
            return second.trim();
        }

        return null;
    }

    private static boolean isNumeric(String value) {
        return value != null && value.matches("\\d+");
    }
}
