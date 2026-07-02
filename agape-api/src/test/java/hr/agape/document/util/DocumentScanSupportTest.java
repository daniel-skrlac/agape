package hr.agape.document.util;

import hr.agape.document.lookup.view.DocumentSlotTypeView;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocumentScanSupportTest {

    @Test
    void supportsSocijalnaDispatchDocument() {
        DocumentSlotTypeView slot = DocumentSlotTypeView.builder()
                .documentCode("OTPREMNICA")
                .storageGroupName("Socijalna samoposluga")
                .build();

        assertTrue(DocumentScanSupport.isSupportedForDispatchSlipScan(slot));
    }

    @Test
    void rejectsDoniranaHranaDispatchDocument() {
        DocumentSlotTypeView slot = DocumentSlotTypeView.builder()
                .documentCode("OTPREMNICA")
                .storageGroupName("Donirana hrana po Pravilniku")
                .build();

        assertFalse(DocumentScanSupport.isSupportedForDispatchSlipScan(slot));
    }

    @Test
    void rejectsNonDispatchDocument() {
        DocumentSlotTypeView slot = DocumentSlotTypeView.builder()
                .documentCode("PRIMKA")
                .storageGroupName("Socijalna samoposluga")
                .build();

        assertFalse(DocumentScanSupport.isSupportedForDispatchSlipScan(slot));
    }
}
