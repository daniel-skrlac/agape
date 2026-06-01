package hr.agape.dispatch.scan.util;

import hr.agape.dispatch.scan.dto.BookingSessionScanLineCandidateDTO;
import hr.agape.item.util.ItemCodeUtil;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.IntStream;

public final class DispatchSlipTextParser {

    public static final String SOURCE_FIXED_LAYOUT = "PREDLOZAK_OTPREMNICE";
    public static final String SOURCE_EXTRA_TEXT = "DODATNI_TEKST";

    private static final List<String> ORG_SLIP_CODES = IntStream.rangeClosed(1, 35)
            .mapToObj(i -> String.format("%04d", i))
            .toList();

    private static final Set<String> ORG_SLIP_CODE_SET = Set.copyOf(ORG_SLIP_CODES);

    private static final Pattern NUMBER_TOKEN = Pattern.compile("\\d+(?:[,.]\\d+)?");
    private static final Pattern CODE_NAME_QTY_LINE = Pattern.compile(
            "^\\s*(\\d{1,8})\\s+(.{2,}?)\\s+(\\d+(?:[,.]\\d+)?)\\s*(?:kom|kg|l|m|pak|pcs)?\\s*$",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );
    private static final Pattern NAME_QTY_LINE = Pattern.compile(
            "^\\s*([\\p{L}][\\p{L}\\d .,'\\-_/]{2,})\\s+(\\d+(?:[,.]\\d+)?)\\s*(?:kom|kg|l|m|pak|pcs)?\\s*$",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );
    private static final Pattern PARTNER_LABEL_PREFIX = Pattern.compile(
            "^(naziv kupca|kupac|partner|primatelj|naziv|dostaviti|za)\\s*[:\\-]?\\s*",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    private DispatchSlipTextParser() {
    }

    private record NumberMatch(String value, int start, int end) {
    }

    public static List<BookingSessionScanLineCandidateDTO> buildCandidates(String rawText) {
        Map<String, BigDecimal> quantityByCode = extractKnownLayoutQuantities(rawText);
        List<BookingSessionScanLineCandidateDTO> out = new ArrayList<>();

        for (String code : ORG_SLIP_CODES) {
            BookingSessionScanLineCandidateDTO line = new BookingSessionScanLineCandidateDTO();
            line.setSlipItemCode(code);
            line.setItemCode(code);
            line.setQuantity(quantityByCode.get(code));
            line.setSource(SOURCE_FIXED_LAYOUT);
            out.add(line);
        }

        out.addAll(extractExtraTextLines(rawText));
        return out;
    }

    public static List<BookingSessionScanLineCandidateDTO> buildExtraCandidates(String rawText) {
        return extractExtraTextLines(rawText);
    }

    public static List<String> partnerSearchTerms(String rawText) {
        String text = normalizeRawText(rawText);
        if (text == null) {
            return List.of();
        }

        Set<String> terms = new LinkedHashSet<>();
        for (String line : text.split("\\R+")) {
            String cleaned = cleanupTextLine(line);
            if (cleaned == null || cleaned.length() < 4) {
                continue;
            }

            String lower = cleaned.toLowerCase();
            if (lower.contains("otprem")
                    || lower.contains("datum")
                    || lower.contains("sklad")
                    || lower.contains("artik")
                    || lower.contains("koli")
                    || lower.contains("sifra")
                    || lower.contains("šifra")) {
                continue;
            }

            if (cleaned.replaceAll("[^0-9]", "").length() > cleaned.length() / 2) {
                continue;
            }

            addPartnerSearchTerms(terms, cleaned);
            if (terms.size() >= 12) {
                break;
            }
        }

        return new ArrayList<>(terms);
    }

    public static String normalizeRawText(String rawText) {
        if (rawText == null) {
            return null;
        }

        String cleaned = rawText
                .replace('\u00a0', ' ')
                .replace("\r\n", "\n")
                .replace('\r', '\n')
                .trim();

        return cleaned.isBlank() ? null : cleaned;
    }

    private static Map<String, BigDecimal> extractKnownLayoutQuantities(String rawText) {
        String text = normalizeRawText(rawText);
        if (text == null) {
            return Map.of();
        }

        List<String> tokens = tokenizeNumbersAndWords(text);
        Map<String, BigDecimal> quantityByCode = new LinkedHashMap<>();

        extractLineBasedKnownQuantities(text, quantityByCode);

        for (int i = 0; i < tokens.size(); i++) {
            String code = normalizePrintedOrgCode(tokens.get(i));
            if (code == null || !ORG_SLIP_CODE_SET.contains(code) || quantityByCode.containsKey(code)) {
                continue;
            }

            for (int j = i + 1; j < Math.min(tokens.size(), i + 9); j++) {
                String token = tokens.get(j);
                String maybeNextCode = normalizePrintedOrgCode(token);
                if (maybeNextCode != null && ORG_SLIP_CODE_SET.contains(maybeNextCode)) {
                    break;
                }

                BigDecimal quantity = parseQuantity(token);
                if (quantity != null) {
                    quantityByCode.put(code, quantity);
                    break;
                }
            }
        }

        return quantityByCode;
    }

    private static void extractLineBasedKnownQuantities(String text, Map<String, BigDecimal> quantityByCode) {
        for (String rawLine : text.split("\\R+")) {
            String line = cleanupTextLine(rawLine);
            if (line == null || looksLikeNonItemText(line)) {
                continue;
            }

            List<NumberMatch> numbers = standaloneNumberMatches(line);
            if (numbers.size() < 2) {
                continue;
            }

            String code = normalizeOrgCode(numbers.getFirst().value());
            if (code == null || !ORG_SLIP_CODE_SET.contains(code) || quantityByCode.containsKey(code)) {
                continue;
            }

            for (int i = numbers.size() - 1; i > 0; i--) {
                BigDecimal quantity = parseQuantity(numbers.get(i).value());
                if (quantity == null) {
                    continue;
                }

                quantityByCode.put(code, quantity);
                break;
            }
        }
    }

    private static List<BookingSessionScanLineCandidateDTO> extractExtraTextLines(String rawText) {
        String text = normalizeRawText(rawText);
        if (text == null) {
            return List.of();
        }

        List<BookingSessionScanLineCandidateDTO> out = new ArrayList<>();

        for (String rawLine : text.split("\\R+")) {
            String line = cleanupTextLine(rawLine);
            if (line == null) {
                continue;
            }

            BookingSessionScanLineCandidateDTO candidate = parseExtraLine(line);
            if (candidate == null) {
                continue;
            }

            out.add(candidate);
        }

        return out;
    }

    private static BookingSessionScanLineCandidateDTO parseExtraLine(String line) {
        Matcher codeMatcher = CODE_NAME_QTY_LINE.matcher(line);
        if (codeMatcher.matches()) {
            String code = normalizeCode(codeMatcher.group(1));
            String orgCode = normalizeOrgCode(codeMatcher.group(1));
            if (orgCode != null && ORG_SLIP_CODE_SET.contains(orgCode)) {
                return null;
            }

            BigDecimal quantity = parseQuantity(codeMatcher.group(3));
            if (quantity == null) {
                return null;
            }

            BookingSessionScanLineCandidateDTO candidate = new BookingSessionScanLineCandidateDTO();
            candidate.setSlipItemCode(code);
            candidate.setItemCode(code);
            candidate.setItemName(cleanupTextLine(codeMatcher.group(2)));
            candidate.setQuantity(quantity);
            candidate.setSource(SOURCE_EXTRA_TEXT);
            return candidate;
        }

        Matcher nameMatcher = NAME_QTY_LINE.matcher(line);
        if (!nameMatcher.matches()) {
            return null;
        }

        BigDecimal quantity = parseQuantity(nameMatcher.group(2));
        if (quantity == null) {
            return null;
        }

        String name = cleanupTextLine(nameMatcher.group(1));
        if (name == null || looksLikeNonItemText(name)) {
            return null;
        }

        BookingSessionScanLineCandidateDTO candidate = new BookingSessionScanLineCandidateDTO();
        candidate.setItemName(name);
        candidate.setQuantity(quantity);
        candidate.setSource(SOURCE_EXTRA_TEXT);
        return candidate;
    }

    private static boolean looksLikeNonItemText(String value) {
        String lower = value.toLowerCase();
        return lower.contains("datum")
                || lower.contains("partner")
                || lower.contains("kupac")
                || lower.contains("potpis")
                || lower.contains("otprem")
                || lower.contains("sklad");
    }

    private static void addPartnerSearchTerms(Set<String> terms, String line) {
        String withoutLabel = cleanupTextLine(PARTNER_LABEL_PREFIX.matcher(line).replaceFirst(""));
        if (withoutLabel == null) {
            return;
        }

        addPartnerTerm(terms, withoutLabel);
        addPartnerTerm(terms, withoutLabel.replaceFirst("^\\d{1,8}\\s+", ""));

        String[] pieces = withoutLabel.split("[|;]");
        for (String piece : pieces) {
            String cleanedPiece = cleanupTextLine(piece);
            addPartnerTerm(terms, cleanedPiece);
            if (cleanedPiece != null) {
                addPartnerTerm(terms, cleanedPiece.replaceFirst("^\\d{1,8}\\s+", ""));
            }
        }

        String[] words = withoutLabel.split("\\s+");
        int maxWords = Math.min(5, words.length);
        for (int size = maxWords; size >= 2; size--) {
            StringBuilder term = new StringBuilder();
            for (int i = 0; i < size; i++) {
                if (i > 0) {
                    term.append(' ');
                }
                term.append(words[i]);
            }
            addPartnerTerm(terms, term.toString());
        }
    }

    private static void addPartnerTerm(Set<String> terms, String value) {
        String term = cleanupTextLine(value);
        if (term == null || term.length() < 4) {
            return;
        }

        String lower = term.toLowerCase();
        if (looksLikeNonItemText(lower)
                || lower.contains("otprem")
                || lower.contains("sklad")
                || lower.contains("artik")
                || lower.contains("koli")
                || lower.contains("sifra")
                || lower.contains("šifra")) {
            return;
        }

        if (term.replaceAll("[^0-9]", "").length() > term.length() / 2) {
            return;
        }

        terms.add(term);
    }

    private static List<String> tokenizeNumbersAndWords(String text) {
        List<String> tokens = new ArrayList<>();
        Matcher matcher = Pattern.compile("[\\p{L}\\d]+(?:[,.]\\d+)?", Pattern.UNICODE_CASE).matcher(text);
        while (matcher.find()) {
            tokens.add(matcher.group());
        }
        return tokens;
    }

    private static List<NumberMatch> standaloneNumberMatches(String line) {
        List<NumberMatch> numbers = new ArrayList<>();
        Matcher matcher = NUMBER_TOKEN.matcher(line);

        while (matcher.find()) {
            if (isStandaloneNumber(line, matcher.start(), matcher.end())) {
                numbers.add(new NumberMatch(matcher.group(), matcher.start(), matcher.end()));
            }
        }

        return numbers;
    }

    private static boolean isStandaloneNumber(String line, int start, int end) {
        return !isLetterOrDigitAt(line, start - 1) && !isLetterOrDigitAt(line, end);
    }

    private static boolean isLetterOrDigitAt(String value, int index) {
        return index >= 0
                && index < value.length()
                && Character.isLetterOrDigit(value.charAt(index));
    }

    private static String normalizeOrgCode(String value) {
        String normalized = normalizeCode(value);
        if (normalized == null || !normalized.matches("\\d{1,4}")) {
            return null;
        }

        return String.format("%04d", Long.parseLong(normalized));
    }

    private static String normalizePrintedOrgCode(String value) {
        if (value == null) {
            return null;
        }

        String digits = value.replaceAll("\\D", "");
        if (digits.length() < 3) {
            return null;
        }

        return normalizeOrgCode(value);
    }

    private static String normalizeCode(String value) {
        String normalized = ItemCodeUtil.normalize(value);
        return normalized == null || normalized.isBlank() ? null : normalized;
    }

    private static BigDecimal parseQuantity(String value) {
        if (value == null) {
            return null;
        }

        Matcher matcher = NUMBER_TOKEN.matcher(value.trim());
        if (!matcher.matches()) {
            return null;
        }

        try {
            BigDecimal quantity = new BigDecimal(value.replace(',', '.'));
            return quantity.signum() > 0 ? quantity : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String cleanupTextLine(String value) {
        if (value == null) {
            return null;
        }

        String cleaned = value
                .replaceAll("\\s+", " ")
                .trim();

        return cleaned.isBlank() ? null : cleaned;
    }
}
