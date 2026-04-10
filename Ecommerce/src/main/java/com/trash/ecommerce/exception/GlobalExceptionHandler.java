package com.trash.ecommerce.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler({
        ProductFingdingException.class,
        InvoiceNotFoundException.class,
        ResourceNotFoundException.class,
        FindingUserError.class
    })
    public ResponseEntity<Map<String, Object>> handleNotFound(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("success", false, "error", ex.getMessage()));
    }

    @ExceptionHandler({
        AccessDeniedException.class,
        UserAuthorizationException.class
    })
    public ResponseEntity<Map<String, Object>> handleForbidden(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(Map.of("success", false, "error", ex.getMessage()));
    }

    @ExceptionHandler({
        CartItemException.class,
        OrderValidException.class,
        OrderExistsException.class,
        ProductCreatingException.class,
        ProductQuantityValidation.class,
        ReviewException.class,
        InvoiceException.class,
        PaymentException.class
    })
    public ResponseEntity<Map<String, Object>> handleBadRequest(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("success", false, "error", ex.getMessage()));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntime(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("success", false, "error", ex.getMessage()));
    }
}
