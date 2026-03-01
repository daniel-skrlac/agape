package hr.agape.common.response;

import jakarta.transaction.TransactionSynchronizationRegistry;
import jakarta.ws.rs.core.Response;

public class ServiceResponseDirector {

    private ServiceResponseDirector(){}

    public static <T> ServiceResponseDTO<T> successOk(T data, String message) {
        return new ServiceResponseBuilder<T>()
                .success(true)
                .statusCode(Response.Status.OK.getStatusCode())
                .data(data)
                .message(message)
                .build();
    }

    public static <T> ServiceResponseDTO<T> successCreated(T data, String message) {
        return new ServiceResponseBuilder<T>()
                .success(true)
                .statusCode(Response.Status.CREATED.getStatusCode())
                .data(data)
                .message(message)
                .build();
    }

    public static <T> ServiceResponseDTO<T> errorBadRequest(String message) {
        return new ServiceResponseBuilder<T>()
                .success(false)
                .statusCode(Response.Status.BAD_REQUEST.getStatusCode())
                .message(message)
                .build();
    }

    public static <T> ServiceResponseDTO<T> badRequestRollback(TransactionSynchronizationRegistry tsr, String msg) {
        tsr.setRollbackOnly();
        return ServiceResponseDirector.errorBadRequest(msg);
    }

    public static <T> ServiceResponseDTO<T> errorNotFound(String message) {
        return new ServiceResponseBuilder<T>()
                .success(false)
                .statusCode(Response.Status.NOT_FOUND.getStatusCode())
                .message(message)
                .build();
    }

    public static <T> ServiceResponseDTO<T> errorForbidden(String message) {
        return new ServiceResponseBuilder<T>()
                .success(false)
                .statusCode(Response.Status.FORBIDDEN.getStatusCode())
                .message(message)
                .build();
    }

    public static <T> ServiceResponseDTO<T> errorInternal(String message) {
        return new ServiceResponseBuilder<T>()
                .success(false)
                .statusCode(Response.Status.INTERNAL_SERVER_ERROR.getStatusCode())
                .message(message)
                .build();
    }

    public static <T> ServiceResponseDTO<T> errorConflict(String message) {
        return new ServiceResponseBuilder<T>()
                .success(false)
                .statusCode(Response.Status.CONFLICT.getStatusCode())
                .message(message)
                .build();
    }

    public static <T> ServiceResponseDTO<T> errorUnauthorized(String message) {
        return new ServiceResponseBuilder<T>()
                .success(false)
                .statusCode(Response.Status.UNAUTHORIZED.getStatusCode())
                .message(message)
                .build();
    }
}
