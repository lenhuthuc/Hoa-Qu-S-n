package com.trash.ecommerce.service;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OrderPaymentExpiryScheduler {

    private final OrderService orderService;

    @Scheduled(fixedDelayString = "${orders.pending-payment.expiry-check-ms:60000}")
    public void expirePendingPayments() {
        orderService.expirePendingPayments();
    }
}
