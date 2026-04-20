package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.SellerDashboardDTO;
import com.trash.ecommerce.dto.TrustScoreDTO;
import com.trash.ecommerce.entity.Order;
import com.trash.ecommerce.entity.OrderItem;
import com.trash.ecommerce.entity.OrderStatus;
import com.trash.ecommerce.entity.ReturnRequest;
import com.trash.ecommerce.entity.ReturnStatus;
import com.trash.ecommerce.entity.Product;
import com.trash.ecommerce.repository.OrderRepository;
import com.trash.ecommerce.repository.ProductRepository;
import com.trash.ecommerce.repository.ReturnRequestRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SellerDashboardServiceImpl implements SellerDashboardService {

    @Autowired
    private ProductRepository productRepository;
    @Autowired
    private OrderRepository orderRepository;
    @Autowired
    private ReturnRequestRepository returnRequestRepository;
    @Autowired
    private TrustScoreService trustScoreService;

    @Override
    public SellerDashboardDTO getDashboard(Long sellerId) {
        List<Product> products = productRepository.findBySellerId(sellerId);
        Set<Long> productIds = products.stream().map(Product::getId).collect(Collectors.toSet());
        List<ReturnRequest> sellerReturns = returnRequestRepository.findBySellerIdOrderByCreatedAtDesc(sellerId);

        // Get all orders containing seller's products
        List<Order> allOrders = orderRepository.findAll();
        List<Order> sellerOrders = allOrders.stream()
                .filter(o -> o.getOrderItems().stream()
                        .anyMatch(oi -> productIds.contains(oi.getProduct().getId())))
                .collect(Collectors.toList());

        BigDecimal totalRevenue = BigDecimal.ZERO;
<<<<<<< HEAD
        BigDecimal refundedRevenue = BigDecimal.ZERO;
        int pendingOrders = 0, shippedOrders = 0, completedOrders = 0, cancelledOrders = 0;
        int refundedOrders = 0;

        Map<LocalDate, BigDecimal> revenueByDate = new TreeMap<>();
        LocalDate today = LocalDate.now(ZoneId.systemDefault());
        LocalDate startDate = today.minusDays(364);
        DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
=======
    BigDecimal refundedRevenue = BigDecimal.ZERO;
        int pendingOrders = 0, shippedOrders = 0, completedOrders = 0, cancelledOrders = 0;
    int refundedOrders = 0;
>>>>>>> fd80c1f037c9743db2252c3f9e6487ff5f8974e1

        // Top products tracking
        Map<Long, SellerDashboardDTO.TopProductDTO> topMap = new HashMap<>();

        for (Order order : sellerOrders) {
            switch (order.getStatus()) {
                case PENDING: case PENDING_PAYMENT: case PLACED: pendingOrders++; break;
                case SHIPPED: shippedOrders++; break;
                case FINISHED: completedOrders++; break;
                case CANCELLED: cancelledOrders++; break;
                default: break;
            }

            if (order.getStatus() == OrderStatus.FINISHED) {
<<<<<<< HEAD
                LocalDate orderDate = order.getCreateAt() != null
                        ? order.getCreateAt().toInstant().atZone(ZoneId.systemDefault()).toLocalDate()
                        : null;

=======
>>>>>>> fd80c1f037c9743db2252c3f9e6487ff5f8974e1
                for (OrderItem oi : order.getOrderItems()) {
                    if (productIds.contains(oi.getProduct().getId())) {
                        BigDecimal lineTotal = oi.getPrice().multiply(BigDecimal.valueOf(oi.getQuantity()));
                        totalRevenue = totalRevenue.add(lineTotal);

                        if (orderDate != null && !orderDate.isBefore(startDate)) {
                            revenueByDate.merge(orderDate, lineTotal, BigDecimal::add);
                        }

                        topMap.merge(oi.getProduct().getId(),
                                new SellerDashboardDTO.TopProductDTO(
                                        oi.getProduct().getId(),
                                        oi.getProduct().getProductName(),
                                        oi.getQuantity(),
                                        lineTotal,
                                        oi.getProduct().getPrimaryImagePath() != null
                                                ? "/api/products/" + oi.getProduct().getId() + "/img"
                                                : null
                                ),
                                (existing, newVal) -> {
                                    existing.setTotalSold(existing.getTotalSold() + newVal.getTotalSold());
                                    existing.setTotalRevenue(existing.getTotalRevenue().add(newVal.getTotalRevenue()));
                                    return existing;
                                });
                    }
                }
            }
        }

<<<<<<< HEAD
        for (LocalDate date = startDate; !date.isAfter(today); date = date.plusDays(1)) {
            revenueByDate.computeIfAbsent(date, key -> BigDecimal.ZERO);
        }

=======
>>>>>>> fd80c1f037c9743db2252c3f9e6487ff5f8974e1
        for (ReturnRequest returnRequest : sellerReturns) {
            if (returnRequest.getStatus() == ReturnStatus.REFUNDED) {
                refundedOrders++;
                if (returnRequest.getRefundAmount() != null) {
                    refundedRevenue = refundedRevenue.add(returnRequest.getRefundAmount());
                }
            }
        }

        BigDecimal netRevenue = totalRevenue.subtract(refundedRevenue);
        if (netRevenue.compareTo(BigDecimal.ZERO) < 0) {
            netRevenue = BigDecimal.ZERO;
        }

        List<SellerDashboardDTO.TopProductDTO> topProducts = topMap.values().stream()
                .sorted((a, b) -> b.getTotalRevenue().compareTo(a.getTotalRevenue()))
                .limit(5)
                .collect(Collectors.toList());

        int totalOrders = sellerOrders.size();
        BigDecimal cancelRate = totalOrders > 0
                ? BigDecimal.valueOf(cancelledOrders).divide(BigDecimal.valueOf(totalOrders), 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        TrustScoreDTO trustScore = trustScoreService.getTrustScore(sellerId);

        SellerDashboardDTO dto = new SellerDashboardDTO();
        dto.setTotalRevenue(totalRevenue);
        dto.setNetRevenue(netRevenue);
        dto.setRefundedRevenue(refundedRevenue);
        dto.setTotalOrders(totalOrders);
        dto.setPendingOrders(pendingOrders);
        dto.setShippedOrders(shippedOrders);
        dto.setCompletedOrders(completedOrders);
        dto.setRefundedOrders(refundedOrders);
        dto.setCancelledOrders(cancelledOrders);
        dto.setTotalProducts(products.size());
        dto.setCancelRate(cancelRate);
        dto.setTopProducts(topProducts);
        dto.setTrustScore(trustScore);
        dto.setRevenueHistory(revenueByDate.entrySet().stream()
                .map(entry -> new SellerDashboardDTO.RevenueHistoryDTO(
                        entry.getKey().format(DateTimeFormatter.ISO_DATE),
                        entry.getValue()
                ))
                .collect(Collectors.toList()));

        return dto;
    }
}
