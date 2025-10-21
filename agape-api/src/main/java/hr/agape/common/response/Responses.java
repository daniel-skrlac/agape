package hr.agape.common.response;

import jakarta.ws.rs.core.Response;

public final class Responses {
    private Responses() {}

    public static <T> Response from(ServiceResponse<T> body) {
        return Response.status(body.getStatusCode()).entity(body).build();
    }
}
