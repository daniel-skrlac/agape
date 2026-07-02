package hr.agape.document.util;

import hr.agape.document.lookup.view.DocumentSlotTypeView;

import java.text.Normalizer;
import java.util.Locale;

public final class DocumentScanSupport {

    private static final String DISPATCH_DOCUMENT_CODE = "OTPREMNICA";
    private static final String SUPPORTED_STORAGE_GROUP_TOKEN = "socijalna";

    private DocumentScanSupport() {
    }

    public static boolean isSupportedForDispatchSlipScan(DocumentSlotTypeView slot) {
        if (slot == null) {
            return false;
        }

        return isSupportedForDispatchSlipScan(slot.getDocumentCode(), slot.getStorageGroupName());
    }

    public static boolean isSupportedForDispatchSlipScan(String documentCode, String storageGroupName) {
        String code = normalize(documentCode);
        String group = normalize(storageGroupName);

        return DISPATCH_DOCUMENT_CODE.toLowerCase(Locale.ROOT).equals(code)
                && group.contains(SUPPORTED_STORAGE_GROUP_TOKEN);
    }

    private static String normalize(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }

        String noAccents = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");

        return noAccents.trim().toLowerCase(Locale.ROOT);
    }
}
