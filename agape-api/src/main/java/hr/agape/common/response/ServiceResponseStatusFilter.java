package hr.agape.common.response;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.ext.Provider;

import java.io.IOException;

@Provider
public class ServiceResponseStatusFilter implements ContainerResponseFilter {

    @Override
    public void filter(ContainerRequestContext requestContext, ContainerResponseContext responseContext) throws IOException {
        int status = statusFor(responseContext.getEntity(), responseContext.getStatus());
        if (status != responseContext.getStatus()) {
            responseContext.setStatus(status);
        }
    }

    static int statusFor(Object entity, int currentStatus) {
        if (!(entity instanceof ServiceResponseDTO<?> body)) {
            return currentStatus;
        }

        int statusCode = body.getStatusCode();
        if (statusCode < 100 || statusCode > 599) {
            return currentStatus;
        }

        return statusCode;
    }
}
