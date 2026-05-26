package hr.agape.dispatch.scan.util;

import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.util.Locale;
import java.util.Set;

public final class DispatchSlipUploadFileUtil {

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/heic",
            "image/heif",
            "image/webp"
    );

    private DispatchSlipUploadFileUtil() {
    }

    public static void validate(FileUpload file) {
        if (file == null || file.uploadedFile() == null) {
            throw new IllegalArgumentException("File is required.");
        }

        String contentType = contentType(file);
        if (!ALLOWED_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Unsupported file type.");
        }
    }

    public static String contentType(FileUpload file) {
        if (file == null) {
            return "application/octet-stream";
        }

        return normalizeContentType(file.contentType());
    }

    private static String normalizeContentType(String value) {
        if (value == null || value.isBlank()) {
            return "application/octet-stream";
        }

        String lower = value.toLowerCase(Locale.ROOT);
        int semicolon = lower.indexOf(';');

        return semicolon >= 0
                ? lower.substring(0, semicolon).trim()
                : lower.trim();
    }
}
