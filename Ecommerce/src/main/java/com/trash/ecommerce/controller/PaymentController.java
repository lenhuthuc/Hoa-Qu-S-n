package com.trash.ecommerce.controller;

import com.trash.ecommerce.config.MoMoConfig;
import com.trash.ecommerce.config.VnPayConfig;
import com.trash.ecommerce.dto.PaymentMethodMessageResponse;
import com.trash.ecommerce.service.JwtService;
import com.trash.ecommerce.service.PaymentService;
import com.trash.ecommerce.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private Logger logger = LoggerFactory.getLogger(PaymentController.class);
    @Autowired
    private PaymentService paymentService;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private UserService userService;
    @Autowired
    private VnPayConfig vnPayConfig;
    @Autowired
    private MoMoConfig moMoConfig;

    @PostMapping("/createUrl")
    public ResponseEntity<?> createUrlVNPay(
            @RequestParam("totalPrice") BigDecimal total_price,
            @RequestParam("orderInfo") String orderInfo,
            @RequestParam("orderId") Long orderId,
            HttpServletRequest request
    ) {
        try {
            String ipAddress = userService.getClientIpAddress(request);
            String Url = paymentService.createPaymentUrl(total_price, orderInfo, orderId, ipAddress);
            return ResponseEntity.ok(Url);
        } catch (Exception e) {
            logger.error("Payment has errors", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(java.util.Map.of("message", e.getMessage() != null ? e.getMessage() : "Lỗi thanh toán"));
        }
    }

    @PostMapping("/createMoMoUrl")
    public ResponseEntity<?> createMoMoUrl(
            @RequestParam("totalPrice") BigDecimal total_price,
            @RequestParam("orderInfo") String orderInfo,
            @RequestParam("orderId") Long orderId
    ) {
        try {
            String Url = paymentService.createMoMoPaymentUrl(total_price, orderInfo, orderId);
            return ResponseEntity.ok(Url);
        } catch (Exception e) {
            logger.error("MoMo payment has errors", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(java.util.Map.of("message", e.getMessage() != null ? e.getMessage() : "Lỗi thanh toán MoMo"));
        }
    }

    @PostMapping("/methods")
    public ResponseEntity<?> addPaymentMethod(
            @RequestHeader("Authorization") String token,
            @RequestParam String name) {
        try {
            Long userId = jwtService.extractId(token);
            PaymentMethodMessageResponse response = paymentService.addPaymentMethod(userId, name);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("addPaymentMethod has errors", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(java.util.Map.of("message", e.getMessage() != null ? e.getMessage() : "Lỗi thêm phương thức thanh toán"));
        }
    }

    @GetMapping("/vnpay/ipn")
    public ResponseEntity<Map<String, String>> handleVnPayIPN(
            HttpServletRequest request) {
        try {
            Map<String, String> response = paymentService.handleProcedurePayment(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("handleVnPayIPN has errors", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/vnpay/return")
    public ResponseEntity<Void> handleVnPayReturn(HttpServletRequest request) {
        try {
            paymentService.handleProcedureUserInterface(request);

            String redirectUrl = vnPayConfig.getFrontendReturnUrl();
            if (redirectUrl == null || redirectUrl.isBlank()) {
                redirectUrl = "https://haquason.uk/payment/return";
            }

            String queryString = request.getQueryString();
            if (queryString != null && !queryString.isBlank()) {
                redirectUrl += redirectUrl.contains("?") ? "&" : "?";
                redirectUrl += queryString;
            }

            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(redirectUrl))
                    .build();
        } catch (Exception e) {
            logger.error("handleVnPayReturn has errors", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/momo/return")
    public ResponseEntity<Void> handleMoMoReturn(HttpServletRequest request) {
        try {
            paymentService.handleMoMoReturn(request);

            String redirectUrl = moMoConfig.getReturnUrl();
            if (redirectUrl == null || redirectUrl.isBlank()) {
                redirectUrl = "https://haquason.uk/payment/return";
            }

            String queryString = request.getQueryString();
            if (queryString != null && !queryString.isBlank()) {
                redirectUrl += (redirectUrl.contains("?") ? "&" : "?") + queryString;
            }

            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(redirectUrl))
                    .build();
        } catch (Exception e) {
            logger.error("handleMoMoReturn has errors", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/momo/notify")
    public ResponseEntity<Map<String, String>> handleMoMoNotify(HttpServletRequest request) {
        try {
            Map<String, String> response = paymentService.handleMoMoNotify(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("handleMoMoNotify has errors", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("RspCode", "99", "Message", "Internal server error"));
        }
    }
}