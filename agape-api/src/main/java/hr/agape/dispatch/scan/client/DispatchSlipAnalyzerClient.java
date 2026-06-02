package hr.agape.dispatch.scan.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import hr.agape.dispatch.scan.dto.DispatchSlipAnalyzerResponseDTO;
import hr.agape.dispatch.scan.util.DispatchSlipUploadFileUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class DispatchSlipAnalyzerClient {

    private final ObjectMapper objectMapper;

    @ConfigProperty(name = "dispatch.scan.analyzer-url", defaultValue = "http://dispatch-slip-analyzer:8000")
    String analyzerUrl;

    @Inject
    public DispatchSlipAnalyzerClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public DispatchSlipAnalyzerResponseDTO analyze(FileUpload file) {
        try {
            String boundary = "AgapeDispatchSlip" + UUID.randomUUID().toString().replace("-", "");
            byte[] body = multipartBody(file, boundary);

            HttpURLConnection connection = (HttpURLConnection) URI.create(
                    normalizeBaseUrl(analyzerUrl) + "/analyze-dispatch-slip"
            ).toURL().openConnection();
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(120_000);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
            connection.setFixedLengthStreamingMode(body.length);

            try (var output = connection.getOutputStream()) {
                output.write(body);
                output.flush();
            }

            int statusCode = connection.getResponseCode();
            String responseBody = readResponseBody(connection, statusCode);

            if (statusCode < 200 || statusCode >= 300) {
                throw new IllegalArgumentException(cleanAnalyzerError(responseBody));
            }

            return objectMapper.readValue(responseBody, DispatchSlipAnalyzerResponseDTO.class);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException(
                    "Analizator otpremnica trenutno nije dostupan."
            );
        }
    }

    private byte[] multipartBody(FileUpload file, String boundary) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        String fileName = file.fileName() == null || file.fileName().isBlank()
                ? "dispatch-slip.jpg"
                : sanitizeFileName(file.fileName());

        String contentType = DispatchSlipUploadFileUtil.contentType(file);
        byte[] fileBytes = Files.readAllBytes(file.uploadedFile());
        if (fileBytes.length == 0) {
            throw new IllegalArgumentException("Slika otpremnice je prazna.");
        }

        write(out, "--" + boundary + "\r\n");
        write(out, "Content-Disposition: form-data; name=\"file\"; filename=\"" + fileName + "\"\r\n");
        write(out, "Content-Type: " + contentType + "\r\n\r\n");
        out.write(fileBytes);
        write(out, "\r\n");
        write(out, "--" + boundary + "--\r\n");

        return out.toByteArray();
    }

    private void write(ByteArrayOutputStream out, String value) throws Exception {
        out.write(value.getBytes(StandardCharsets.UTF_8));
    }

    private String normalizeBaseUrl(String value) {
        if (value == null || value.isBlank()) {
            return "http://dispatch-slip-analyzer:8000";
        }

        return value.endsWith("/")
                ? value.substring(0, value.length() - 1)
                : value;
    }

    private String sanitizeFileName(String value) {
        return value.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    private String readResponseBody(HttpURLConnection connection, int statusCode) throws Exception {
        InputStream stream = statusCode >= 200 && statusCode < 300
                ? connection.getInputStream()
                : connection.getErrorStream();

        if (stream == null) {
            return "";
        }

        try (stream) {
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private String cleanAnalyzerError(String body) {
        if (body == null || body.isBlank()) {
            return "Analiza otpremnice nije uspjela.";
        }

        try {
            Map<?, ?> json = objectMapper.readValue(body, Map.class);
            Object detail = json.get("detail");
            Object message = json.get("message");
            Object error = json.get("error");
            Object clean = detail != null ? detail : message != null ? message : error;

            if (clean != null && !clean.toString().isBlank()) {
                return "Analiza otpremnice nije uspjela: " + translateAnalyzerMessage(clean.toString());
            }
        } catch (Exception ignored) {
        }

        return "Analiza otpremnice nije uspjela: " + translateAnalyzerMessage(body.replaceAll("\\s+", " ").trim());
    }

    private String translateAnalyzerMessage(String value) {
        String text = value == null ? "" : value.trim();
        String lower = text.toLowerCase();

        if (lower.contains("multipart field") && lower.contains("file") && lower.contains("required")) {
            return "Datoteka slike nije poslana.";
        }

        if (lower.contains("field required") && lower.contains("file")) {
            return "Datoteka slike nije poslana.";
        }

        if (lower.contains("unsupported file type") || lower.contains("unsupported media type")) {
            return "Format slike nije podržan.";
        }

        if (lower.contains("cannot decode") || lower.contains("invalid image")) {
            return "Sliku nije moguće pročitati.";
        }

        if (lower.contains("internal server error")) {
            return "Interna greška analizatora.";
        }

        return text;
    }
}
