package hr.agape.dispatch.scan.util;

import org.jboss.resteasy.reactive.multipart.FileUpload;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.IntPredicate;
import java.util.stream.IntStream;

public final class DispatchSlipImageHeuristicParser {

    private static final int GRID_COLUMNS = 7;
    private static final int GRID_ROWS = 5;
    private static final List<String> ORG_SLIP_CODES = IntStream.rangeClosed(1, 35)
            .mapToObj(i -> String.format("%04d", i))
            .toList();

    private static final String[] DIGIT_TEMPLATES = {
            "01110" + "10001" + "10011" + "10101" + "11001" + "10001" + "01110",
            "00100" + "01100" + "00100" + "00100" + "00100" + "00100" + "01110",
            "01110" + "10001" + "00001" + "00010" + "00100" + "01000" + "11111",
            "11110" + "00001" + "00001" + "01110" + "00001" + "00001" + "11110",
            "00010" + "00110" + "01010" + "10010" + "11111" + "00010" + "00010",
            "11111" + "10000" + "10000" + "11110" + "00001" + "00001" + "11110",
            "01110" + "10000" + "10000" + "11110" + "10001" + "10001" + "01110",
            "11111" + "00001" + "00010" + "00100" + "01000" + "01000" + "01000",
            "01110" + "10001" + "10001" + "01110" + "10001" + "10001" + "01110",
            "01110" + "10001" + "10001" + "01111" + "00001" + "00001" + "01110"
    };

    private DispatchSlipImageHeuristicParser() {
    }

    public record Analysis(Map<String, BigDecimal> quantities, LocalDate documentDate, Integer partnerNumber) {
        public static Analysis empty() {
            return new Analysis(Map.of(), null, null);
        }
    }

    private record Rect(int x, int y, int w, int h) {
        Rect inset(float left, float top, float right, float bottom) {
            int nx = x + Math.round(w * left);
            int ny = y + Math.round(h * top);
            int nr = x + Math.round(w * right);
            int nb = y + Math.round(h * bottom);
            return new Rect(nx, ny, Math.max(1, nr - nx), Math.max(1, nb - ny));
        }
    }

    private record DigitCandidate(int value, double score) {
    }

    private record Component(Rect rect, int pixels) {
    }

    public static Map<String, BigDecimal> extractKnownLayoutQuantities(FileUpload file) {
        return analyze(file).quantities();
    }

    public static Analysis analyze(FileUpload file) {
        try {
            if (file == null || file.uploadedFile() == null || !DispatchSlipUploadFileUtil.contentType(file).startsWith("image/")) {
                return Analysis.empty();
            }

            Path path = file.uploadedFile();
            BufferedImage image = ImageIO.read(path.toFile());
            if (image == null || image.getWidth() < 160 || image.getHeight() < 160) {
                return Analysis.empty();
            }

            Rect paper = findPaperRect(image);
            Rect grid = findGridRect(image, paper);

            return new Analysis(
                    extractQuantities(image, grid),
                    readDocumentDate(image, paper),
                    readPartnerNumber(image, paper)
            );
        } catch (Exception e) {
            return Analysis.empty();
        }
    }

    private static Map<String, BigDecimal> extractQuantities(BufferedImage image, Rect grid) {
        Map<String, BigDecimal> out = new LinkedHashMap<>();

        int cellW = Math.max(1, grid.w() / GRID_COLUMNS);
        int cellH = Math.max(1, grid.h() / GRID_ROWS);

        for (int i = 0; i < ORG_SLIP_CODES.size(); i++) {
            int row = i / GRID_COLUMNS;
            int col = i % GRID_COLUMNS;
            Rect cell = new Rect(grid.x() + col * cellW, grid.y() + row * cellH, cellW, cellH);
            Integer quantity = readBlueQuantity(image, cell);
            if (quantity != null && quantity > 0) {
                out.put(ORG_SLIP_CODES.get(i), BigDecimal.valueOf(quantity));
            }
        }

        return out;
    }

    private static Rect findPaperRect(BufferedImage image) {
        int minX = image.getWidth();
        int minY = image.getHeight();
        int maxX = -1;
        int maxY = -1;

        for (int y = 0; y < image.getHeight(); y += 2) {
            for (int x = 0; x < image.getWidth(); x += 2) {
                int rgb = image.getRGB(x, y);
                int r = red(rgb);
                int g = green(rgb);
                int b = blue(rgb);
                int max = Math.max(r, Math.max(g, b));
                int min = Math.min(r, Math.min(g, b));

                if (max >= 165 && max - min <= 72) {
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        if (maxX <= minX || maxY <= minY) {
            return new Rect(0, 0, image.getWidth(), image.getHeight());
        }

        int w = maxX - minX + 1;
        int h = maxY - minY + 1;
        if (w < image.getWidth() * 0.35 || h < image.getHeight() * 0.35) {
            return new Rect(0, 0, image.getWidth(), image.getHeight());
        }

        int padX = Math.round(w * 0.015f);
        int padY = Math.round(h * 0.015f);
        int x = clamp(minX - padX, 0, image.getWidth() - 1);
        int y = clamp(minY - padY, 0, image.getHeight() - 1);
        int right = clamp(maxX + padX, x + 1, image.getWidth());
        int bottom = clamp(maxY + padY, y + 1, image.getHeight());

        return new Rect(x, y, right - x, bottom - y);
    }

    private static Rect findGridRect(BufferedImage image, Rect paper) {
        Rect fallback = paper.inset(0.055f, 0.195f, 0.955f, 0.825f);
        Rect search = paper.inset(0.035f, 0.165f, 0.970f, 0.845f);

        List<Integer> horizontal = linePeaks(
                search.y(),
                search.y() + search.h(),
                y -> countLinePixelsX(image, search.x(), search.x() + search.w(), y),
                Math.max(24, Math.round(search.w() * 0.18f)),
                Math.max(3, Math.round(search.h() * 0.012f))
        );
        List<Integer> vertical = linePeaks(
                search.x(),
                search.x() + search.w(),
                x -> countLinePixelsY(image, x, search.y(), search.y() + search.h()),
                Math.max(18, Math.round(search.h() * 0.12f)),
                Math.max(3, Math.round(search.w() * 0.010f))
        );

        if (horizontal.size() < 4 || vertical.size() < 5) {
            return fallback;
        }

        int top = horizontal.getFirst();
        int bottom = horizontal.getLast();
        int left = vertical.getFirst();
        int right = vertical.getLast();

        if (right - left < fallback.w() * 0.55 || bottom - top < fallback.h() * 0.55) {
            return fallback;
        }

        return new Rect(left, top, right - left, bottom - top);
    }

    private static List<Integer> linePeaks(
            int start,
            int end,
            java.util.function.IntUnaryOperator scoreFn,
            int threshold,
            int mergeDistance
    ) {
        List<Integer> peaks = new ArrayList<>();
        int runStart = -1;
        int runBest = -1;
        int runScore = -1;

        for (int i = start; i < end; i++) {
            int score = scoreFn.applyAsInt(i);
            if (score >= threshold) {
                if (runStart < 0) {
                    runStart = i;
                    runBest = i;
                    runScore = score;
                } else if (score > runScore) {
                    runBest = i;
                    runScore = score;
                }
            } else if (runStart >= 0) {
                addMergedPeak(peaks, runBest, mergeDistance);
                runStart = -1;
                runBest = -1;
                runScore = -1;
            }
        }

        if (runStart >= 0) {
            addMergedPeak(peaks, runBest, mergeDistance);
        }

        return peaks;
    }

    private static void addMergedPeak(List<Integer> peaks, int value, int mergeDistance) {
        if (!peaks.isEmpty() && value - peaks.getLast() <= mergeDistance) {
            peaks.set(peaks.size() - 1, Math.round((peaks.getLast() + value) / 2.0f));
            return;
        }
        peaks.add(value);
    }

    private static int countLinePixelsX(BufferedImage image, int x0, int x1, int y) {
        int count = 0;
        for (int x = x0; x < x1; x += 2) {
            if (isGridInk(image.getRGB(clamp(x, 0, image.getWidth() - 1), clamp(y, 0, image.getHeight() - 1)))) {
                count++;
            }
        }
        return count;
    }

    private static int countLinePixelsY(BufferedImage image, int x, int y0, int y1) {
        int count = 0;
        for (int y = y0; y < y1; y += 2) {
            if (isGridInk(image.getRGB(clamp(x, 0, image.getWidth() - 1), clamp(y, 0, image.getHeight() - 1)))) {
                count++;
            }
        }
        return count;
    }

    private static Integer readBlueQuantity(BufferedImage image, Rect cell) {
        Rect qtyRegion = cell.inset(0.10f, 0.45f, 0.90f, 0.96f);
        String digits = readDigitSequence(image, qtyRegion, DispatchSlipImageHeuristicParser::isBlueInk, 0.48, 2);
        if (digits.isBlank()) {
            digits = readDigitSequence(image, qtyRegion, DispatchSlipImageHeuristicParser::isAnyDarkInk, 0.52, 2);
        }

        if (digits.isBlank()) {
            return null;
        }

        try {
            int parsed = Integer.parseInt(digits);
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static LocalDate readDocumentDate(BufferedImage image, Rect paper) {
        Rect region = paper.inset(0.565f, 0.060f, 0.895f, 0.170f);
        String digits = readDigitSequence(image, region, DispatchSlipImageHeuristicParser::isAnyDarkInk, 0.50, 10);
        if (digits.length() < 6) {
            digits = readDigitSequence(image, region, DispatchSlipImageHeuristicParser::isBlueInk, 0.46, 10);
        }

        return parseDateDigits(digits);
    }

    private static Integer readPartnerNumber(BufferedImage image, Rect paper) {
        Rect region = paper.inset(0.055f, 0.055f, 0.430f, 0.165f);
        String digits = readDigitSequence(image, region, DispatchSlipImageHeuristicParser::isAnyDarkInk, 0.50, 8);
        if (digits.isBlank()) {
            digits = readDigitSequence(image, region, DispatchSlipImageHeuristicParser::isBlueInk, 0.46, 8);
        }

        if (digits.isBlank()) {
            return null;
        }

        try {
            int parsed = Integer.parseInt(digits);
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static LocalDate parseDateDigits(String digits) {
        if (digits == null) {
            return null;
        }

        String onlyDigits = digits.replaceAll("\\D", "");
        for (int i = 0; i + 8 <= onlyDigits.length(); i++) {
            LocalDate date = parseDate(onlyDigits.substring(i, i + 8), false);
            if (date != null) {
                return date;
            }
        }

        for (int i = 0; i + 6 <= onlyDigits.length(); i++) {
            LocalDate date = parseDate(onlyDigits.substring(i, i + 6), true);
            if (date != null) {
                return date;
            }
        }

        return null;
    }

    private static LocalDate parseDate(String value, boolean shortYear) {
        try {
            int day = Integer.parseInt(value.substring(0, 2));
            int month = Integer.parseInt(value.substring(2, 4));
            int year = shortYear
                    ? 2000 + Integer.parseInt(value.substring(4, 6))
                    : Integer.parseInt(value.substring(4, 8));

            if (year < 2020 || year > 2035) {
                return null;
            }

            return LocalDate.of(year, month, day);
        } catch (DateTimeException | NumberFormatException e) {
            return null;
        }
    }

    private static String readDigitSequence(
            BufferedImage image,
            Rect rawRegion,
            IntPredicate inkPredicate,
            double minScore,
            int maxDigits
    ) {
        Rect region = clampRect(rawRegion, image);
        List<Component> components = digitComponents(image, region, inkPredicate);
        if (components.isEmpty()) {
            return "";
        }

        StringBuilder out = new StringBuilder();
        int medianHeight = medianHeight(components);
        int minHeight = Math.max(4, Math.round(medianHeight * 0.45f));

        for (Component component : components) {
            if (out.length() >= maxDigits) {
                break;
            }

            Rect rect = component.rect();
            if (rect.h() < minHeight || rect.w() < 2 || component.pixels() < 3) {
                continue;
            }

            DigitCandidate digit = classifyDigit(image, rect, inkPredicate);
            if (digit.score() >= minScore) {
                out.append(digit.value());
            }
        }

        return out.toString();
    }

    private static List<Component> digitComponents(BufferedImage image, Rect region, IntPredicate inkPredicate) {
        List<Component> components = new ArrayList<>();
        int[] columnCounts = new int[region.w()];

        for (int dx = 0; dx < region.w(); dx++) {
            int x = region.x() + dx;
            int count = 0;
            for (int y = region.y(); y < region.y() + region.h(); y++) {
                if (inkPredicate.test(image.getRGB(x, y))) {
                    count++;
                }
            }
            columnCounts[dx] = count;
        }

        int gapLimit = Math.max(2, Math.round(region.w() * 0.012f));
        int start = -1;
        int lastInk = -1;
        int gap = 0;

        for (int dx = 0; dx < columnCounts.length; dx++) {
            boolean hasInk = columnCounts[dx] >= Math.max(1, region.h() * 0.015);
            if (hasInk) {
                if (start < 0) {
                    start = dx;
                }
                lastInk = dx;
                gap = 0;
                continue;
            }

            if (start >= 0 && ++gap > gapLimit) {
                Component component = componentForRun(image, region, start, lastInk, inkPredicate);
                if (component != null) {
                    components.add(component);
                }
                start = -1;
                lastInk = -1;
                gap = 0;
            }
        }

        if (start >= 0 && lastInk >= start) {
            Component component = componentForRun(image, region, start, lastInk, inkPredicate);
            if (component != null) {
                components.add(component);
            }
        }

        return mergeCloseComponents(components, Math.max(2, Math.round(region.w() * 0.01f)));
    }

    private static Component componentForRun(
            BufferedImage image,
            Rect region,
            int startDx,
            int endDx,
            IntPredicate inkPredicate
    ) {
        int minX = region.x() + startDx;
        int maxX = region.x() + endDx;
        int minY = region.y() + region.h();
        int maxY = region.y();
        int pixels = 0;

        for (int x = minX; x <= maxX; x++) {
            for (int y = region.y(); y < region.y() + region.h(); y++) {
                if (!inkPredicate.test(image.getRGB(x, y))) {
                    continue;
                }
                pixels++;
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }

        if (pixels < 3 || maxY <= minY) {
            return null;
        }

        return new Component(new Rect(minX, minY, maxX - minX + 1, maxY - minY + 1), pixels);
    }

    private static List<Component> mergeCloseComponents(List<Component> components, int maxGap) {
        if (components.size() < 2) {
            return components;
        }

        List<Component> out = new ArrayList<>();
        Component current = components.getFirst();

        for (int i = 1; i < components.size(); i++) {
            Component next = components.get(i);
            int gap = next.rect().x() - (current.rect().x() + current.rect().w());
            boolean smallFragment = next.rect().h() < current.rect().h() * 0.35 || current.rect().h() < next.rect().h() * 0.35;
            if (gap <= maxGap && !smallFragment) {
                current = merge(current, next);
            } else {
                out.add(current);
                current = next;
            }
        }

        out.add(current);
        return out;
    }

    private static Component merge(Component a, Component b) {
        int x = Math.min(a.rect().x(), b.rect().x());
        int y = Math.min(a.rect().y(), b.rect().y());
        int right = Math.max(a.rect().x() + a.rect().w(), b.rect().x() + b.rect().w());
        int bottom = Math.max(a.rect().y() + a.rect().h(), b.rect().y() + b.rect().h());
        return new Component(new Rect(x, y, right - x, bottom - y), a.pixels() + b.pixels());
    }

    private static int medianHeight(List<Component> components) {
        List<Integer> heights = components.stream()
                .map(component -> component.rect().h())
                .sorted()
                .toList();
        return heights.isEmpty() ? 0 : heights.get(heights.size() / 2);
    }

    private static DigitCandidate classifyDigit(BufferedImage image, Rect rect, IntPredicate inkPredicate) {
        boolean[][] normalized = normalizeInk(image, padRect(rect, 0.12f, 0.10f), inkPredicate);
        int bestDigit = -1;
        double bestScore = 0.0;

        for (int digit = 0; digit < DIGIT_TEMPLATES.length; digit++) {
            double score = scoreTemplate(normalized, DIGIT_TEMPLATES[digit]);
            if (score > bestScore) {
                bestScore = score;
                bestDigit = digit;
            }
        }

        return new DigitCandidate(bestDigit, bestScore);
    }

    private static boolean[][] normalizeInk(BufferedImage image, Rect rect, IntPredicate inkPredicate) {
        boolean[][] out = new boolean[7][5];

        for (int gy = 0; gy < 7; gy++) {
            int y0 = rect.y() + Math.round((rect.h() * gy) / 7.0f);
            int y1 = rect.y() + Math.round((rect.h() * (gy + 1)) / 7.0f);

            for (int gx = 0; gx < 5; gx++) {
                int x0 = rect.x() + Math.round((rect.w() * gx) / 5.0f);
                int x1 = rect.x() + Math.round((rect.w() * (gx + 1)) / 5.0f);
                int pixels = 0;
                int ink = 0;

                for (int yy = y0; yy < Math.max(y0 + 1, y1); yy++) {
                    for (int xx = x0; xx < Math.max(x0 + 1, x1); xx++) {
                        int x = clamp(xx, 0, image.getWidth() - 1);
                        int y = clamp(yy, 0, image.getHeight() - 1);
                        pixels++;
                        if (inkPredicate.test(image.getRGB(x, y))) {
                            ink++;
                        }
                    }
                }

                out[gy][gx] = ink >= Math.max(1, pixels * 0.07);
            }
        }

        return out;
    }

    private static double scoreTemplate(boolean[][] actual, String template) {
        int matches = 0;
        int total = 0;

        for (int y = 0; y < 7; y++) {
            for (int x = 0; x < 5; x++) {
                boolean expected = template.charAt(y * 5 + x) == '1';
                if (actual[y][x] == expected) {
                    matches++;
                }
                total++;
            }
        }

        return total == 0 ? 0.0 : (double) matches / total;
    }

    private static boolean isGridInk(int rgb) {
        int brightness = brightness(rgb);
        int spread = spread(rgb);
        return brightness < 188 && spread < 55;
    }

    private static boolean isBlueInk(int rgb) {
        int r = red(rgb);
        int g = green(rgb);
        int b = blue(rgb);
        int max = Math.max(r, Math.max(g, b));
        int min = Math.min(r, Math.min(g, b));
        int brightness = (r + g + b) / 3;

        return brightness < 238
                && max - min >= 12
                && b >= 55
                && b >= r + 4
                && b >= g - 16;
    }

    private static boolean isAnyDarkInk(int rgb) {
        return brightness(rgb) < 178 || isBlueInk(rgb);
    }

    private static int red(int rgb) {
        return (rgb >> 16) & 0xff;
    }

    private static int green(int rgb) {
        return (rgb >> 8) & 0xff;
    }

    private static int blue(int rgb) {
        return rgb & 0xff;
    }

    private static int brightness(int rgb) {
        return (red(rgb) + green(rgb) + blue(rgb)) / 3;
    }

    private static int spread(int rgb) {
        int r = red(rgb);
        int g = green(rgb);
        int b = blue(rgb);
        return Math.max(r, Math.max(g, b)) - Math.min(r, Math.min(g, b));
    }

    private static Rect clampRect(Rect rect, BufferedImage image) {
        int x = clamp(rect.x(), 0, image.getWidth() - 1);
        int y = clamp(rect.y(), 0, image.getHeight() - 1);
        int right = clamp(rect.x() + rect.w(), x + 1, image.getWidth());
        int bottom = clamp(rect.y() + rect.h(), y + 1, image.getHeight());
        return new Rect(x, y, right - x, bottom - y);
    }

    private static Rect padRect(Rect rect, float xRatio, float yRatio) {
        int padX = Math.max(1, Math.round(rect.w() * xRatio));
        int padY = Math.max(1, Math.round(rect.h() * yRatio));
        return new Rect(rect.x() - padX, rect.y() - padY, rect.w() + padX * 2, rect.h() + padY * 2);
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}
