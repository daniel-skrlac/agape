package hr.agape.common.response;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ServiceResponseStatusFilterTest {

    @Test
    void usesServiceResponseStatusCodeForDirectDtoResponses() {
        ServiceResponseDTO<Void> response = ServiceResponseDirector.errorConflict("Duplicate");

        assertEquals(409, ServiceResponseStatusFilter.statusFor(response, 200));
    }

    @Test
    void keepsCurrentStatusForNonServiceResponses() {
        assertEquals(201, ServiceResponseStatusFilter.statusFor("plain", 201));
    }

    @Test
    void keepsCurrentStatusWhenServiceResponseStatusCodeIsNotHttpStatus() {
        ServiceResponseDTO<Void> response = new ServiceResponseDTO<>();
        response.setStatusCode(0);

        assertEquals(200, ServiceResponseStatusFilter.statusFor(response, 200));
    }
}
