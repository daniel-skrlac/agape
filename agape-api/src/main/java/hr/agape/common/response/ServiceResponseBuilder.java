package hr.agape.common.response;

public class ServiceResponseBuilder<T> {
    private final ServiceResponse<T> response = new ServiceResponse<>();

    public ServiceResponseBuilder<T> success(boolean success) {
        response.setSuccess(success);
        return this;
    }

    public ServiceResponseBuilder<T> message(String message) {
        response.setMessage(message);
        return this;
    }

    public ServiceResponseBuilder<T> statusCode(int statusCode) {
        response.setStatusCode(statusCode);
        return this;
    }

    public ServiceResponseBuilder<T> data(T data) {
        response.setData(data);
        return this;
    }

    public ServiceResponse<T> build() {
        return response;
    }
}
