package hr.agape.common.response;

import jakarta.ws.rs.core.Response;

public class ServiceResponseDirector {

    private ServiceResponseDirector(){}

    public static <T> ServiceResponse<T> successOk(T data, String message) {
        return new ServiceResponseBuilder<T>()
                .success(true)
                .statusCode(Response.Status.OK.getStatusCode())
                .data(data)
                .message(message)
                .build();
    }

    public static <T> ServiceResponse<T> successCreated(T data, String message) {
        return new ServiceResponseBuilder<T>()
                .success(true)
                .statusCode(Response.Status.CREATED.getStatusCode())
                .data(data)
                .message(message)
                .build();
    }

    public static <T> ServiceResponse<T> errorBadRequest(String message) {
        return new ServiceResponseBuilder<T>()
                .success(false)
                .statusCode(Response.Status.BAD_REQUEST.getStatusCode())
                .message(message)
                .build();
    }

    public static <T> ServiceResponse<T> errorNotFound(String message) {
        return new ServiceResponseBuilder<T>()
                .success(false)
                .statusCode(Response.Status.NOT_FOUND.getStatusCode())
                .message(message)
                .build();
    }

    public static <T> ServiceResponse<T> errorForbidden(String message) {
        return new ServiceResponseBuilder<T>()
                .success(false)
                .statusCode(Response.Status.FORBIDDEN.getStatusCode())
                .message(message)
                .build();
    }

    public static <T> ServiceResponse<T> errorInternal(String message) {
        return new ServiceResponseBuilder<T>()
                .success(false)
                .statusCode(Response.Status.INTERNAL_SERVER_ERROR.getStatusCode())
                .message(message)
                .build();
    }

    public static <T> ServiceResponse<T> errorConflict(String message) {
        return new ServiceResponseBuilder<T>()
                .success(false)
                .statusCode(Response.Status.CONFLICT.getStatusCode())
                .message(message)
                .build();
    }

    public static <T> ServiceResponse<T> errorUnauthorized(String message) {
        return new ServiceResponseBuilder<T>()
                .success(false)
                .statusCode(Response.Status.UNAUTHORIZED.getStatusCode())
                .message(message)
                .build();
    }
}
