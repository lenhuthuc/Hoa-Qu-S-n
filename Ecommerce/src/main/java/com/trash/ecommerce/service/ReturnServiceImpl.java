package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.ReturnRequestCreateDTO;
import com.trash.ecommerce.dto.ReturnRequestDTO;
import com.trash.ecommerce.entity.*;
import com.trash.ecommerce.repository.OrderRepository;
import com.trash.ecommerce.repository.ReturnRequestRepository;
import com.trash.ecommerce.repository.SellerApplicationRepository;
import com.trash.ecommerce.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Locale;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ReturnServiceImpl implements ReturnService {

    @Autowired
    private ReturnRequestRepository returnRequestRepository;
    @Autowired
    private OrderRepository orderRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private SellerApplicationRepository sellerApplicationRepository;
    @Autowired
    private TrustScoreService trustScoreService;
    @Autowired
    private NotificationService notificationService;
    @Autowired
    private EventPublisher eventPublisher;

    @Override
    @Transactional
    public ReturnRequestDTO createReturnRequest(Long buyerId, ReturnRequestCreateDTO dto) {
        if (dto == null || dto.getOrderId() == null) {
            throw new RuntimeException("Order not found");
        }

        Order requestedOrder = orderRepository.findById(dto.getOrderId())
                .orElseThrow(() -> new RuntimeException("Order not found"));

        Order order = resolveReturnOrder(requestedOrder);

        if (!order.getUser().getId().equals(buyerId)) {
            throw new RuntimeException("You can only create return requests for your own orders");
        }

        if (order.getStatus() != OrderStatus.FINISHED) {
            throw new RuntimeException("Return request can only be created after buyer confirms receipt");
        }

        if (order.getBuyerConfirmedAt() == null) {
            throw new RuntimeException("This order has not been marked as received yet");
        }

        LocalDateTime buyerConfirmedAt = order.getBuyerConfirmedAt().toInstant()
                .atZone(ZoneId.systemDefault())
                .toLocalDateTime();
        LocalDateTime deadline = buyerConfirmedAt.plusHours(24);
        if (LocalDateTime.now().isAfter(deadline)) {
            throw new RuntimeException("Return request window has expired");
        }

        if (returnRequestRepository.existsByOrderId(order.getId())) {
            throw new RuntimeException("A return request already exists for this order");
        }

        Users seller = resolveSeller(order);

        Users buyer = userRepository.findById(buyerId)
                .orElseThrow(() -> new RuntimeException("Buyer not found"));

        ReturnRequest rr = new ReturnRequest();
        rr.setOrder(order);
        rr.setBuyer(buyer);
        rr.setSeller(seller);
        rr.setReasonCode(dto.getReasonCode());
        rr.setDescription(dto.getDescription());
        rr.setEvidenceUrls(normalizeEvidenceUrls(dto.getEvidenceUrls()));
        rr.setRefundAmount(dto.getRefundAmount() != null ? dto.getRefundAmount() : order.getTotalPrice());
        rr.setStatus(ReturnStatus.PENDING);
        rr.setDeadline(deadline);

        returnRequestRepository.save(rr);

        // Notify seller about new return request
        notificationService.send(seller.getId(),
                "Yêu cầu trả hàng mới",
                "Đơn hàng #" + order.getId() + " có yêu cầu trả hàng từ " + buyer.getFullName(),
                NotificationType.RETURN_REQUESTED,
                rr.getId());
        eventPublisher.publishNotification(seller.getId(),
                "Yêu cầu trả hàng mới", "RETURN_REQUESTED", rr.getId());

        return toDTO(rr);
    }

    private Order resolveReturnOrder(Order requestedOrder) {
        if (requestedOrder.getMasterOrder() != null && requestedOrder.getMasterOrder()) {
            List<Order> childOrders = orderRepository.findByParentOrderIdOrderByCreateAtAsc(requestedOrder.getId());
            if (childOrders.isEmpty()) {
                return requestedOrder;
            }
            if (childOrders.size() > 1) {
                throw new RuntimeException("Đơn hàng có nhiều nhà bán, vui lòng tạo yêu cầu theo từng đơn con");
            }
            return childOrders.get(0);
        }
        return requestedOrder;
    }

    private Users resolveSeller(Order order) {
        if (order.getSeller() != null) {
            return order.getSeller();
        }
        return order.getOrderItems().stream()
                .findFirst()
                .map(oi -> oi.getProduct().getSeller())
                .orElseThrow(() -> new RuntimeException("Seller not found for this order"));
    }

    @Override
    public List<ReturnRequestDTO> getMyReturnRequests(Long userId) {
        return returnRequestRepository.findByBuyerIdOrderByCreatedAtDesc(userId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    public List<ReturnRequestDTO> getSellerReturnRequests(Long sellerId) {
        return returnRequestRepository.findBySellerIdOrderByCreatedAtDesc(sellerId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ReturnRequestDTO sellerRespond(Long sellerId, Long returnId, String action, String response) {
        ReturnRequest rr = returnRequestRepository.findById(returnId)
                .orElseThrow(() -> new RuntimeException("Return request not found"));

        if (!rr.getSeller().getId().equals(sellerId)) {
            throw new RuntimeException("You can only respond to your own return requests");
        }

        if (rr.getStatus() != ReturnStatus.PENDING) {
            throw new RuntimeException("This return request cannot be responded to");
        }

        String normalizedAction = action == null ? "" : action.toUpperCase(Locale.ROOT);
        boolean shouldRecalculateTrustScore = false;

        switch (normalizedAction) {
            case "ACCEPT":
                rr.setSellerResponse(response);
                rr.setStatus(ReturnStatus.REFUNDED);
                shouldRecalculateTrustScore = true;
                break;
            case "REJECT":
                if (response == null || response.trim().isEmpty()) {
                    throw new RuntimeException("Vui lòng nhập lý do từ chối");
                }
                rr.setSellerResponse(response);
                rr.setStatus(ReturnStatus.REJECTED);
                break;
            default:
                throw new RuntimeException("Invalid action. Use: ACCEPT or REJECT");
        }

        returnRequestRepository.save(rr);

        if (shouldRecalculateTrustScore) {
            trustScoreService.recalculateTrustScore(sellerId);
        }

        // Notify buyer about seller response
        Long buyerId2 = rr.getBuyer().getId();
        switch (action.toUpperCase()) {
            case "ACCEPT":
                notificationService.send(buyerId2, "Yêu cầu trả hàng được chấp nhận",
                        "Yêu cầu trả hàng #" + returnId + " đã được chấp nhận và hoàn tiền",
                        NotificationType.RETURN_REFUNDED, returnId);
                break;
            case "REJECT":
                notificationService.send(buyerId2, "Yêu cầu trả hàng bị từ chối",
                "Yêu cầu trả hàng #" + returnId + " đã bị từ chối. Bạn có thể chấp nhận hoặc khiếu nại lên sàn.",
                        NotificationType.RETURN_REJECTED, returnId);
                break;
        }
        eventPublisher.publishNotification(buyerId2,
                "Cập nhật trả hàng", "RETURN_UPDATE", returnId);

        return toDTO(rr);
    }

    @Override
    @Transactional
    public ReturnRequestDTO buyerDecision(Long buyerId, Long returnId, String action) {
        ReturnRequest rr = returnRequestRepository.findById(returnId)
                .orElseThrow(() -> new RuntimeException("Return request not found"));

        if (!rr.getBuyer().getId().equals(buyerId)) {
            throw new RuntimeException("You can only process your own return requests");
        }

        if (rr.getStatus() != ReturnStatus.REJECTED) {
            throw new RuntimeException("This return request is not waiting for buyer decision");
        }

        String normalizedAction = action == null ? "" : action.toUpperCase(Locale.ROOT);
        Long sellerId = rr.getSeller().getId();

        switch (normalizedAction) {
            case "ACCEPT_REJECTION":
                rr.setStatus(ReturnStatus.REJECTED_ACCEPTED);
                notificationService.send(sellerId,
                        "Người mua đã chấp nhận quyết định từ chối",
                        "Yêu cầu trả hàng #" + returnId + " đã được người mua chấp nhận quyết định từ chối",
                        NotificationType.RETURN_REJECTED,
                        returnId);
                eventPublisher.publishNotification(sellerId,
                        "Quyết định từ chối đã được chấp nhận", "RETURN_REJECTED_ACCEPTED", returnId);
                break;
            case "ESCALATE":
                rr.setStatus(ReturnStatus.ESCALATED);
                notificationService.send(sellerId,
                        "Người mua đã khiếu nại lên sàn",
                        "Yêu cầu trả hàng #" + returnId + " đã được người mua khiếu nại lên sàn để admin xử lý",
                        NotificationType.SYSTEM,
                        returnId);
                eventPublisher.publishNotification(sellerId,
                        "Khiếu nại đã được chuyển admin", "RETURN_ESCALATED", returnId);
                break;
            default:
                throw new RuntimeException("Invalid action. Use: ACCEPT_REJECTION or ESCALATE");
        }

        returnRequestRepository.save(rr);

        return toDTO(rr);
    }

    @Override
    public ReturnRequestDTO getReturnById(Long userId, Long returnId) {
        ReturnRequest rr = returnRequestRepository.findById(returnId)
                .orElseThrow(() -> new RuntimeException("Return request not found"));

        if (!rr.getBuyer().getId().equals(userId) && !rr.getSeller().getId().equals(userId)) {
            throw new RuntimeException("Access denied");
        }

        return toDTO(rr);
    }

    private ReturnRequestDTO toDTO(ReturnRequest rr) {
        ReturnRequestDTO dto = new ReturnRequestDTO();
        dto.setId(rr.getId());
        dto.setOrderId(rr.getOrder().getId());
        dto.setBuyerId(rr.getBuyer().getId());
        dto.setBuyerName(rr.getBuyer().getFullName());
        dto.setSellerId(rr.getSeller().getId());
        dto.setSellerName(resolveShopName(rr.getSeller()));
        dto.setReasonCode(rr.getReasonCode());
        dto.setDescription(rr.getDescription());
        dto.setEvidenceUrls(rr.getEvidenceUrls());
        dto.setRefundAmount(rr.getRefundAmount());
        dto.setStatus(rr.getStatus());
        dto.setSellerResponse(rr.getSellerResponse());
        dto.setCreatedAt(rr.getCreatedAt());
        dto.setUpdatedAt(rr.getUpdatedAt());
        dto.setDeadline(rr.getDeadline());
        return dto;
    }

    private String resolveShopName(Users seller) {
        if (seller == null || seller.getId() == null) {
            return null;
        }

        return sellerApplicationRepository.findByUserId(seller.getId())
                .map(app -> app.getShopName() != null && !app.getShopName().isBlank() ? app.getShopName().trim() : null)
                .orElseGet(() -> {
                    if (seller.getFullName() != null && !seller.getFullName().isBlank()) {
                        return seller.getFullName().trim();
                    }
                    if (seller.getUsername() != null && !seller.getUsername().isBlank()) {
                        return seller.getUsername().trim();
                    }
                    return null;
                });
    }

    private String normalizeEvidenceUrls(String evidenceUrls) {
        if (evidenceUrls == null) {
            return null;
        }
        String trimmed = evidenceUrls.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
