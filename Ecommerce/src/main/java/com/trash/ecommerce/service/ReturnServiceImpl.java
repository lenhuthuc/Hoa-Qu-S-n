package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.ReturnRequestCreateDTO;
import com.trash.ecommerce.dto.ReturnRequestDTO;
import com.trash.ecommerce.entity.*;
import com.trash.ecommerce.repository.OrderRepository;
import com.trash.ecommerce.repository.ReturnRequestRepository;
import com.trash.ecommerce.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
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
    private TrustScoreService trustScoreService;
    @Autowired
    private NotificationService notificationService;
    @Autowired
    private EventPublisher eventPublisher;

    @Override
    @Transactional
    public ReturnRequestDTO createReturnRequest(Long buyerId, ReturnRequestCreateDTO dto) {
        Order order = orderRepository.findById(dto.getOrderId())
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (!order.getUser().getId().equals(buyerId)) {
            throw new RuntimeException("You can only create return requests for your own orders");
        }

        if (order.getStatus() != OrderStatus.FINISHED && order.getStatus() != OrderStatus.SHIPPED) {
            throw new RuntimeException("Return request can only be created for delivered/completed orders");
        }

        if (returnRequestRepository.existsByOrderIdAndBuyerId(dto.getOrderId(), buyerId)) {
            throw new RuntimeException("A return request already exists for this order");
        }

        // Find seller from order items
        Users seller = order.getOrderItems().stream()
                .findFirst()
                .map(oi -> oi.getProduct().getSeller())
                .orElseThrow(() -> new RuntimeException("Seller not found for this order"));

        Users buyer = userRepository.findById(buyerId)
                .orElseThrow(() -> new RuntimeException("Buyer not found"));

        ReturnRequest rr = new ReturnRequest();
        rr.setOrder(order);
        rr.setBuyer(buyer);
        rr.setSeller(seller);
        rr.setReasonCode(dto.getReasonCode());
        rr.setDescription(dto.getDescription());
        rr.setEvidenceUrls(dto.getEvidenceUrls());
        rr.setRefundAmount(dto.getRefundAmount() != null ? dto.getRefundAmount() : order.getTotalPrice());
        rr.setStatus(ReturnStatus.PENDING);
        rr.setDeadline(LocalDateTime.now().plusHours(24)); // Seller has 24h to respond

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

        if (rr.getStatus() != ReturnStatus.PENDING && rr.getStatus() != ReturnStatus.NEGOTIATING) {
            throw new RuntimeException("This return request cannot be responded to");
        }

        rr.setSellerResponse(response);

        switch (action.toUpperCase()) {
            case "ACCEPT":
                rr.setStatus(ReturnStatus.APPROVED);
                // Trigger refund (no product return needed for fresh produce)
                rr.setStatus(ReturnStatus.REFUNDED);
                // Recalculate trust score
                trustScoreService.recalculateTrustScore(sellerId);
                break;
            case "REJECT":
                rr.setStatus(ReturnStatus.REJECTED);
                break;
            case "NEGOTIATE":
                rr.setStatus(ReturnStatus.NEGOTIATING);
                break;
            default:
                throw new RuntimeException("Invalid action. Use: ACCEPT, REJECT, or NEGOTIATE");
        }

        returnRequestRepository.save(rr);

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
                        "Yêu cầu trả hàng #" + returnId + " đã bị từ chối",
                        NotificationType.RETURN_REJECTED, returnId);
                break;
            case "NEGOTIATE":
                notificationService.send(buyerId2, "Người bán muốn thương lượng",
                        "Yêu cầu trả hàng #" + returnId + ": " + response,
                        NotificationType.RETURN_REQUESTED, returnId);
                break;
        }
        eventPublisher.publishNotification(buyerId2,
                "Cập nhật trả hàng", "RETURN_UPDATE", returnId);

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
        dto.setSellerName(rr.getSeller().getFullName());
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
}
