package com.trash.ecommerce.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import com.trash.ecommerce.dto.OrderPreviewResponseDTO;
import com.trash.ecommerce.dto.OrderSummaryDTO;
import com.trash.ecommerce.dto.OrderSubOrderDTO;
import com.trash.ecommerce.dto.ShippingValidationResponse;
import com.trash.ecommerce.entity.*;
import com.trash.ecommerce.exception.*;
import com.trash.ecommerce.mapper.OrderMapper;
import com.trash.ecommerce.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.trash.ecommerce.dto.CartItemDetailsResponseDTO;
import com.trash.ecommerce.dto.OrderMessageResponseDTO;
import com.trash.ecommerce.dto.OrderResponseDTO;

@Service
public class OrderServiceImpl implements OrderService {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private OrderRepository orderRepository;
    @Autowired
    private PaymentMethodRepository paymentMethodRepository;
    @Autowired
    private PaymentService paymentService;
    @Autowired
    private CartRepository cartRepository;
    @Autowired
    private OrderMapper orderMapper;
    @Autowired
    private ProductRepository productRepository;
    @Autowired
    private InvoiceService invoiceService;
    @Autowired
    private NotificationService notificationService;
    @Autowired
    private EventPublisher eventPublisher;
    @Autowired
    private EmailService emailService;
    @Autowired
    private VoucherRepository voucherRepository;
    @Autowired
    private ShippingValidationService shippingValidationService;

    @Value("${orders.pending-payment.expiry-minutes:15}")
    private long pendingPaymentExpiryMinutes;

    @Override
    public List<OrderSummaryDTO> getAllMyOrders(Long userId, String ipAddress) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null");
        }
        
        List<Order> orders = orderRepository.findByUserIdOrderByCreateAtDesc(userId);
        
        if (orders == null || orders.isEmpty()) {
            return List.of(); 
        }

        return orders.stream()
                .filter(order -> order != null) 
                .map(order -> {
                    try {
                        return orderMapper.toOrderSummaryDTO(order, resolvePaymentUrl(order, ipAddress));
                    } catch (Exception e) {
                        return orderMapper.toOrderSummaryDTO(order, null);
                    }
                })
                .filter(dto -> dto != null) 
                .collect(Collectors.toList());
    }

    @Override
    public OrderResponseDTO getOrderById(Long userId, Long orderId, String IpAddress) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));

        boolean isBuyer = order.getUser() != null && order.getUser().getId().equals(userId);
        boolean isSeller = false;
        if (!isBuyer) {
            isSeller = order.getSeller() != null && order.getSeller().getId().equals(userId);
            if (!isSeller && (order.getMasterOrder() == null || !order.getMasterOrder())) {
                List<Product> sellerProducts = productRepository.findBySellerId(userId);
                Set<Long> sellerProductIds = sellerProducts.stream().map(Product::getId).collect(Collectors.toSet());
                isSeller = order.getOrderItems().stream()
                        .anyMatch(oi -> sellerProductIds.contains(oi.getProduct().getId()));
            }
        }
        if ((order.getMasterOrder() != null && order.getMasterOrder()) && !isBuyer) {
            throw new AccessDeniedException("Sellers can only access their own sub-orders");
        }
        if (!isBuyer && !isSeller) {
            throw new AccessDeniedException("You do not have permission to view this order");
        }

        OrderResponseDTO dto = orderMapper.toOrderResponseDTO(order, resolvePaymentUrl(order, IpAddress));
        if (order.getMasterOrder() != null && order.getMasterOrder()) {
            List<Order> childOrders = orderRepository.findByParentOrderIdOrderByCreateAtAsc(order.getId());
            dto.setSubOrders(childOrders.stream().map(this::toSubOrderDTO).collect(Collectors.toList()));
        }
        dto.setViewerRole(isSeller ? "SELLER" : "BUYER");
        return dto;
    }

    @Override
    public OrderPreviewResponseDTO previewBuyNowOrder(Long userId, Long productId, Long quantity,
                                                      String discountVoucherCode, String shippingVoucherCode,
                                                      String deliveryType, String toDistrictId, String toWardCode) {
        Users user = userRepository.findById(userId)
                .orElseThrow(() -> new FindingUserError("User not found"));

        PreviewContext preview = buildSingleItemPreviewContext(
                user,
                productId,
                quantity,
                discountVoucherCode,
                shippingVoucherCode,
                deliveryType,
                toDistrictId,
                toWardCode,
                false
        );
        return preview.preview;
    }

        @Override
        public OrderPreviewResponseDTO previewMyOrder(Long userId, String discountVoucherCode, String shippingVoucherCode,
                              String deliveryType, String toDistrictId, String toWardCode) {
        Users user = userRepository.findById(userId)
            .orElseThrow(() -> new FindingUserError("User not found"));

        PreviewContext preview = buildPreviewContext(
            user,
            discountVoucherCode,
            shippingVoucherCode,
            deliveryType,
            toDistrictId,
            toWardCode,
            false
        );

        return preview.preview;
        }

    @Override
    @Transactional
        public List<OrderResponseDTO> createMyOrder(Long userId, Long paymentMethodId, String discountVoucherCode,
                          String shippingVoucherCode, String deliveryType,
                          String toDistrictId, String toWardCode, String IpAddress) {
        Users user = userRepository.findById(userId)
                .orElseThrow(() -> new FindingUserError("User not found"));

        PreviewContext previewContext = buildPreviewContext(
            user,
            discountVoucherCode,
            shippingVoucherCode,
            deliveryType,
            toDistrictId,
            toWardCode,
            true
        );
        if (!previewContext.preview.isCanCheckout()) {
            throw new OrderValidException("Phương thức giao hàng không khả dụng cho giỏ hàng hiện tại");
        }

        Cart cart = previewContext.cart;
        Set<OrderItem> orderItems = previewContext.orderItems;
        PaymentMethod paymentMethod = paymentMethodRepository.findById(paymentMethodId)
                .orElseThrow(() -> new PaymentException("Payment method not found"));
        com.trash.ecommerce.entity.Address address = user.getAddress();
        if (address == null) {
            throw new OrderValidException("User address is required to create an order");
        }

        boolean onlinePayment = isOnlinePaymentMethod(paymentMethod);
        OrderStatus initialStatus = onlinePayment ? OrderStatus.PENDING_PAYMENT : OrderStatus.PLACED;

        Map<Long, Set<OrderItem>> itemsBySeller = new LinkedHashMap<>();
        Map<Long, BigDecimal> subtotalBySeller = new HashMap<>();
        for (OrderItem item : orderItems) {
            Long sellerId = item.getProduct().getSeller().getId();
            if (sellerId != null && sellerId.equals(userId)) {
                throw new OrderValidException("Bạn không thể mua sản phẩm của chính shop mình");
            }
            itemsBySeller.computeIfAbsent(sellerId, k -> new LinkedHashSet<>()).add(item);
            BigDecimal lineAmount = item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
            subtotalBySeller.merge(sellerId, lineAmount, BigDecimal::add);
        }

        String normalizedDistrictId = normalizeDistrictId(toDistrictId);
        String normalizedWardCode = (toWardCode == null || toWardCode.isBlank()) ? "21012" : toWardCode;
        Map<Long, BigDecimal> shippingBySeller = computeShippingFeeBySeller(itemsBySeller,
                previewContext.preview.getDeliveryType(), normalizedDistrictId, normalizedWardCode);

        BigDecimal totalSubtotal = subtotalBySeller.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalShipping = shippingBySeller.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalDiscount = previewContext.preview.getDiscountAmount() != null
            ? previewContext.preview.getDiscountAmount() : BigDecimal.ZERO;
        BigDecimal totalShippingDiscount = previewContext.preview.getShippingDiscountAmount() != null
            ? previewContext.preview.getShippingDiscountAmount() : BigDecimal.ZERO;

        Order paymentOrder = null;
        if (onlinePayment) {
            BigDecimal paymentShippingFee = totalShipping.subtract(totalShippingDiscount);
            if (paymentShippingFee.compareTo(BigDecimal.ZERO) < 0) {
                paymentShippingFee = BigDecimal.ZERO;
            }

            paymentOrder = new Order();
            paymentOrder.setCreateAt(new Date());
            paymentOrder.setUser(user);
            paymentOrder.setSeller(null);
            paymentOrder.setParentOrder(null);
            paymentOrder.setMasterOrder(true);
            paymentOrder.setPaymentMethod(paymentMethod);
            paymentOrder.setAddress(address);
            paymentOrder.setStatus(OrderStatus.PENDING_PAYMENT);
            paymentOrder.setShippingFee(paymentShippingFee);
            paymentOrder.setTotalPrice(previewContext.preview.getTotalAmount());
            orderRepository.save(paymentOrder);
        }

        List<OrderResponseDTO> createdOrders = new ArrayList<>();
        BigDecimal allocatedDiscount = BigDecimal.ZERO;
        BigDecimal allocatedShippingDiscount = BigDecimal.ZERO;
        int sellerCount = itemsBySeller.size();
        int idx = 0;

        for (Map.Entry<Long, Set<OrderItem>> entry : itemsBySeller.entrySet()) {
            idx++;
            Long sellerId = entry.getKey();
            Users seller = userRepository.findById(sellerId)
                .orElseThrow(() -> new ResourceNotFoundException("Seller not found"));

            BigDecimal sellerSubtotal = subtotalBySeller.getOrDefault(sellerId, BigDecimal.ZERO);
            BigDecimal sellerShipping = shippingBySeller.getOrDefault(sellerId, BigDecimal.ZERO);

            BigDecimal sellerDiscount;
            BigDecimal sellerShippingDiscount;
            if (idx == sellerCount) {
            sellerDiscount = totalDiscount.subtract(allocatedDiscount);
            sellerShippingDiscount = totalShippingDiscount.subtract(allocatedShippingDiscount);
            } else {
            sellerDiscount = proportion(totalDiscount, sellerSubtotal, totalSubtotal);
            sellerShippingDiscount = proportion(totalShippingDiscount, sellerShipping, totalShipping);
            allocatedDiscount = allocatedDiscount.add(sellerDiscount);
            allocatedShippingDiscount = allocatedShippingDiscount.add(sellerShippingDiscount);
            }

            BigDecimal sellerTotal = sellerSubtotal
                .add(sellerShipping)
                .subtract(sellerDiscount)
                .subtract(sellerShippingDiscount);
            if (sellerTotal.compareTo(BigDecimal.ZERO) < 0) {
            sellerTotal = BigDecimal.ZERO;
            }

            BigDecimal finalSellerShipping = sellerShipping.subtract(sellerShippingDiscount);
            if (finalSellerShipping.compareTo(BigDecimal.ZERO) < 0) {
            finalSellerShipping = BigDecimal.ZERO;
            }

            Order order = new Order();
            order.setCreateAt(new Date());
            order.setUser(user);
            order.setSeller(seller);
            order.setParentOrder(paymentOrder);
            order.setMasterOrder(false);
            order.setPaymentMethod(paymentMethod);
            order.setAddress(address);
            order.setStatus(initialStatus);
            order.setShippingFee(finalSellerShipping);
            order.setTotalPrice(sellerTotal);
            orderRepository.save(order);

            Set<OrderItem> sellerItems = cloneItemsForOrder(entry.getValue(), order);
            order.setOrderItems(sellerItems);
            orderRepository.save(order);

            if (paymentMethod.getId() == 1L && order.getInvoice() == null) {
            invoiceService.createInvoice(userId, order.getId(), paymentMethodId);
            }

            notificationService.send(seller.getId(),
                "Có đơn hàng mới #" + order.getId(),
                "Bạn có đơn hàng mới từ " + (user.getFullName() != null ? user.getFullName() : user.getEmail()),
                NotificationType.ORDER_PLACED,
                order.getId());

            eventPublisher.publishOrderUpdate(userId, order.getId(), order.getStatus().name(), "Đặt hàng thành công");

            createdOrders.add(new OrderResponseDTO(
                order.getId(),
                paymentOrder != null ? paymentOrder.getId() : order.getId(),
                order.getOrderNumber(),
                sellerItems.stream().map(orderMapper::toCartItemDetailsResponseDTO).collect(Collectors.toSet()),
                order.getTotalPrice(),
                order.getShippingFee(),
                order.getStatus(),
                address.getFullAddress(),
                null,
                order.getCreateAt(),
                order.getBuyerConfirmedAt(),
                null,
                paymentMethod.getMethodName(),
                "BUYER"
            ));
        }

        // Reserve stock for both COD and online payments.
        for (OrderItem orderItem : orderItems) {
            int updatedRows = productRepository.decreaseStock(orderItem.getProduct().getId(), orderItem.getQuantity());
            if (updatedRows == 0) {
                throw new ProductQuantityValidation("Sản phẩm " + orderItem.getProduct().getProductName() + " đã hết hàng!");
            }
        }

        cartRepository.deleteCartItems(cart.getId());

        return createdOrders;
    }

    @Override
    @Transactional
    public OrderResponseDTO createBuyNowOrder(Long userId, Long productId, Long quantity, Long paymentMethodId,
                                              String discountVoucherCode, String shippingVoucherCode,
                                              String deliveryType, String toDistrictId, String toWardCode,
                                              String IpAddress) {
        Users user = userRepository.findById(userId)
                .orElseThrow(() -> new FindingUserError("User not found"));

        PreviewContext previewContext = buildSingleItemPreviewContext(
                user,
                productId,
                quantity,
                discountVoucherCode,
                shippingVoucherCode,
                deliveryType,
                toDistrictId,
                toWardCode,
                true
        );

        if (!previewContext.preview.isCanCheckout()) {
            throw new OrderValidException("Phương thức giao hàng không khả dụng cho sản phẩm này");
        }

        PaymentMethod paymentMethod = paymentMethodRepository.findById(paymentMethodId)
                .orElseThrow(() -> new PaymentException("Payment method not found"));
        boolean onlinePayment = isOnlinePaymentMethod(paymentMethod);

        com.trash.ecommerce.entity.Address address = user.getAddress();
        if (address == null) {
            throw new OrderValidException("User address is required to create an order");
        }

        Order order = new Order();
        order.setCreateAt(new Date());
        order.setUser(user);
        OrderItem sampleItem = previewContext.orderItems.iterator().next();
        order.setSeller(sampleItem.getProduct().getSeller());
        order.setMasterOrder(false);
        order.setPaymentMethod(paymentMethod);
        order.setAddress(address);
        order.setTotalPrice(previewContext.preview.getTotalAmount());
        order.setShippingFee(previewContext.preview.getShippingFee().subtract(previewContext.preview.getShippingDiscountAmount()));
        order.setStatus(onlinePayment ? OrderStatus.PENDING_PAYMENT : OrderStatus.PLACED);
        orderRepository.save(order);

        Set<OrderItem> orderItems = previewContext.orderItems;
        for (OrderItem item : orderItems) {
            item.setOrder(order);
        }
        order.setOrderItems(orderItems);
        orderRepository.save(order);

        for (OrderItem orderItem : orderItems) {
            int updatedRows = productRepository.decreaseStock(orderItem.getProduct().getId(), orderItem.getQuantity());
            if (updatedRows == 0) {
                throw new ProductQuantityValidation("Sản phẩm " + orderItem.getProduct().getProductName() + " đã hết hàng!");
            }
        }

        if (!onlinePayment && order.getInvoice() == null) {
            invoiceService.createInvoice(userId, order.getId(), paymentMethodId);
        }

        Set<Long> notifiedSellers = new HashSet<>();
        for (OrderItem oi : orderItems) {
            Long sellerId = oi.getProduct().getSeller().getId();
            if (notifiedSellers.add(sellerId)) {
                notificationService.send(sellerId,
                        "Có đơn hàng mới #" + order.getId(),
                        "Bạn có đơn hàng mới từ " + (user.getFullName() != null ? user.getFullName() : user.getEmail()),
                        NotificationType.ORDER_PLACED, order.getId());
            }
        }

        eventPublisher.publishOrderUpdate(userId, order.getId(), order.getStatus().name(), "Đặt hàng thành công");

        return new OrderResponseDTO(
                order.getId(),
            order.getId(),
                order.getOrderNumber(),
                previewContext.responseItems,
                order.getTotalPrice(),
                order.getShippingFee(),
                order.getStatus(),
                address.getFullAddress(),
                null,
                order.getCreateAt(),
            order.getBuyerConfirmedAt(),
                null,
                paymentMethod.getMethodName(),
                "BUYER"
        );
    }

    @Override
    @Transactional
    public OrderMessageResponseDTO deleteOrder(Long userId, Long orderId) {
        Order order = orderRepository.findById(orderId)
                                        .orElseThrow(() -> new OrderExistsException("Order not found"));
        
        if (order.getUser() == null || !order.getUser().getId().equals(userId)) {
            throw new AccessDeniedException("You do not have permission to delete this order");
        }
        
        if (order.getStatus() != OrderStatus.PENDING && order.getStatus() != OrderStatus.PENDING_PAYMENT && order.getStatus() != OrderStatus.PLACED) {
            throw new OrderValidException("You can't delete this order ;-;");
        }

        releaseReservedStock(order);

        List<Order> targetOrders = (order.getMasterOrder() != null && order.getMasterOrder())
                ? orderRepository.findByParentOrderIdOrderByCreateAtAsc(order.getId())
                : List.of(order);

        for (Order targetOrder : targetOrders) {
            if (targetOrder.getSeller() != null) {
                notificationService.send(targetOrder.getSeller().getId(),
                        "Đơn hàng #" + targetOrder.getId() + " đã bị hủy",
                        "Người mua đã hủy đơn hàng #" + targetOrder.getId(),
                        NotificationType.ORDER_CANCELLED,
                        targetOrder.getId());
            }
        }
        eventPublisher.publishOrderUpdate(userId, orderId, "CANCELLED", "Đơn hàng đã bị hủy");

        if (order.getMasterOrder() != null && order.getMasterOrder()) {
            for (Order child : targetOrders) {
                orderRepository.delete(child);
            }
        }

        orderRepository.delete(order);
        return new OrderMessageResponseDTO("Delete order successful");
    }

    @Override
    @Transactional
    public OrderMessageResponseDTO updateBuyerOrderStatus(Long userId, Long orderId, String status) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));

        boolean isBuyer = order.getUser() != null && order.getUser().getId().equals(userId);
        boolean isSeller = false;
        if (!isBuyer) {
            isSeller = order.getSeller() != null && order.getSeller().getId().equals(userId);
            if (!isSeller && (order.getMasterOrder() == null || !order.getMasterOrder())) {
                List<Product> sellerProducts = productRepository.findBySellerId(userId);
                Set<Long> sellerProductIds = sellerProducts.stream().map(Product::getId).collect(Collectors.toSet());
                isSeller = order.getOrderItems().stream()
                        .anyMatch(oi -> sellerProductIds.contains(oi.getProduct().getId()));
            }
        }
        if ((order.getMasterOrder() != null && order.getMasterOrder()) && isSeller) {
            throw new AccessDeniedException("Sellers cannot update aggregate master order");
        }
        if (!isBuyer && !isSeller) {
            throw new AccessDeniedException("You do not have permission to update this order");
        }

        OrderStatus newStatus;
        try {
            newStatus = OrderStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new OrderValidException("Invalid status: " + status);
        }

        OrderStatus current = order.getStatus();
        List<Order> childOrders = (order.getMasterOrder() != null && order.getMasterOrder())
                ? orderRepository.findByParentOrderIdOrderByCreateAtAsc(order.getId())
                : List.of(order);

        if (isSeller) {
            // Seller transitions: PLACED/PAID→PREPARING, PREPARING→SHIPPED, SHIPPED→FINISHED, PLACED/PREPARING→CANCELLED
            if (!isValidSellerTransition(current, newStatus)) {
                throw new OrderValidException("Invalid status transition from " + current + " to " + newStatus);
            }
        } else {
            // Buyer can only set FINISHED (confirm received) or CANCELLED
            if (newStatus != OrderStatus.FINISHED && newStatus != OrderStatus.CANCELLED) {
                throw new OrderValidException("Buyer can only confirm receipt or cancel order");
            }
            if (newStatus == OrderStatus.FINISHED) {
                if (order.getMasterOrder() != null && order.getMasterOrder()) {
                    boolean allShipped = !childOrders.isEmpty() && childOrders.stream()
                            .allMatch(child -> child.getStatus() == OrderStatus.SHIPPED);
                    if (!allShipped) {
                        throw new OrderValidException("Chỉ có thể xác nhận khi tất cả đơn con đã ở trạng thái giao hàng");
                    }
                } else if (current != OrderStatus.SHIPPED) {
                    throw new OrderValidException("Can only confirm receipt when order is being shipped");
                }
            }
            if (newStatus == OrderStatus.CANCELLED) {
                if (order.getMasterOrder() != null && order.getMasterOrder()) {
                    boolean canCancelAll = childOrders.stream().allMatch(child ->
                            child.getStatus() == OrderStatus.PLACED
                                    || child.getStatus() == OrderStatus.PENDING
                                    || child.getStatus() == OrderStatus.PENDING_PAYMENT
                                    || child.getStatus() == OrderStatus.PREPARING);
                    if (!canCancelAll) {
                        throw new OrderValidException("Không thể hủy vì có đơn con đã qua giai đoạn chuẩn bị");
                    }
                } else if (current != OrderStatus.PLACED && current != OrderStatus.PENDING
                        && current != OrderStatus.PENDING_PAYMENT && current != OrderStatus.PREPARING) {
                    throw new OrderValidException("Cannot cancel order in current status: " + current);
                }
            }
        }

        Date now = new Date();
        if (!isSeller && order.getMasterOrder() != null && order.getMasterOrder()
                && (newStatus == OrderStatus.FINISHED || newStatus == OrderStatus.CANCELLED)) {
            for (Order child : childOrders) {
                child.setStatus(newStatus);
                if (newStatus == OrderStatus.FINISHED) {
                    child.setBuyerConfirmedAt(now);
                }
                orderRepository.save(child);
            }
        }

        order.setStatus(newStatus);
        if (newStatus == OrderStatus.FINISHED) {
            if (current == OrderStatus.SHIPPED || (order.getMasterOrder() != null && order.getMasterOrder())) {
                order.setBuyerConfirmedAt(now);
            }
        }
        orderRepository.save(order);

        if (newStatus == OrderStatus.CANCELLED) {
            releaseReservedStock(order);
        }

        Long buyerId = order.getUser().getId();

        if (isSeller) {
            // Notify buyer
            String buyerMsg = switch (newStatus) {
                case PREPARING -> "Đơn hàng #" + orderId + " đang được đóng gói";
                case SHIPPED -> "Đơn hàng #" + orderId + " đã được giao cho đơn vị vận chuyển";
                case FINISHED -> "Đơn hàng #" + orderId + " đã hoàn thành. Cảm ơn bạn!";
                case CANCELLED -> "Đơn hàng #" + orderId + " đã bị hủy bởi người bán";
                default -> "Đơn hàng #" + orderId + " đã cập nhật trạng thái: " + newStatus;
            };
            NotificationType notifType = switch (newStatus) {
                case SHIPPED -> NotificationType.ORDER_SHIPPED;
                case FINISHED -> NotificationType.ORDER_COMPLETED;
                case CANCELLED -> NotificationType.ORDER_CANCELLED;
                default -> NotificationType.ORDER_PLACED;
            };
            notificationService.send(buyerId, "Cập nhật đơn hàng #" + orderId, buyerMsg, notifType, orderId);
            eventPublisher.publishOrderUpdate(buyerId, orderId, newStatus.name(), buyerMsg);
        } else {
            // Notify sellers
            List<Order> targetOrders = (order.getMasterOrder() != null && order.getMasterOrder())
                ? orderRepository.findByParentOrderIdOrderByCreateAtAsc(order.getId())
                : List.of(order);
            for (Order targetOrder : targetOrders) {
            Long sellerId = targetOrder.getSeller() != null ? targetOrder.getSeller().getId() : null;
            if (sellerId != null) {
                String msg = newStatus == OrderStatus.FINISHED
                    ? "Người mua đã xác nhận nhận hàng đơn #" + targetOrder.getId()
                    : "Người mua đã hủy đơn hàng #" + targetOrder.getId();
                NotificationType type = newStatus == OrderStatus.FINISHED
                    ? NotificationType.ORDER_COMPLETED : NotificationType.ORDER_CANCELLED;
                notificationService.send(sellerId, "Cập nhật đơn hàng #" + targetOrder.getId(), msg, type, targetOrder.getId());
                }
            }
            String eventMsg = newStatus == OrderStatus.FINISHED
                    ? "Đã xác nhận nhận hàng" : "Đơn hàng đã bị hủy bởi người mua";
            eventPublisher.publishOrderUpdate(buyerId, orderId, newStatus.name(), eventMsg);
        }

        String resultMsg = switch (newStatus) {
            case PREPARING -> "Đơn hàng đang được chuẩn bị";
            case SHIPPED -> "Đơn hàng đang được giao";
            case FINISHED -> "Đã xác nhận nhận hàng thành công";
            case CANCELLED -> "Đã hủy đơn hàng thành công";
            default -> "Cập nhật trạng thái thành công";
        };
        return new OrderMessageResponseDTO(resultMsg);
    }

    private boolean isValidSellerTransition(OrderStatus from, OrderStatus to) {
        if (from == OrderStatus.PLACED && to == OrderStatus.PREPARING) return true;
        if (from == OrderStatus.PAID && to == OrderStatus.PREPARING) return true;
        if (from == OrderStatus.PREPARING && to == OrderStatus.SHIPPED) return true;
        if (from == OrderStatus.PLACED && to == OrderStatus.SHIPPED) return true;
        if (from == OrderStatus.PAID && to == OrderStatus.SHIPPED) return true;
        if (from == OrderStatus.SHIPPED && to == OrderStatus.FINISHED) return true;
        if (from == OrderStatus.PLACED && to == OrderStatus.CANCELLED) return true;
        if (from == OrderStatus.PREPARING && to == OrderStatus.CANCELLED) return true;
        return false;
    }

    @Override
    public String retryPendingPayment(Long userId, Long orderId, String IpAddress) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        if (order.getUser() == null || !order.getUser().getId().equals(userId)) {
            throw new AccessDeniedException("You do not have permission to retry this order");
        }
        Order paymentOrder = order;
        if (order.getParentOrder() != null) {
            paymentOrder = order.getParentOrder();
        }

        if (paymentOrder.getStatus() != OrderStatus.PENDING_PAYMENT) {
            throw new OrderValidException("Order is not waiting for payment");
        }
        if (isPaymentExpired(paymentOrder)) {
            List<Order> targetOrders = (paymentOrder.getMasterOrder() != null && paymentOrder.getMasterOrder())
                    ? orderRepository.findByParentOrderIdOrderByCreateAtAsc(paymentOrder.getId())
                    : List.of(paymentOrder);
            for (Order targetOrder : targetOrders) {
                releaseReservedStock(targetOrder);
                targetOrder.setStatus(OrderStatus.CANCELLED);
                orderRepository.save(targetOrder);
            }
            paymentOrder.setStatus(OrderStatus.CANCELLED);
            orderRepository.save(paymentOrder);
            throw new OrderValidException("Đơn hàng đã hết hạn thanh toán");
        }

        if (paymentOrder.getPaymentMethod() == null) {
            throw new PaymentException("Payment method not found");
        }

        if (paymentOrder.getPaymentMethod().getId() == 2L) {
            return paymentService.createPaymentUrl(
                    paymentOrder.getTotalPrice(),
                    "Thanh toán đơn hàng #" + paymentOrder.getId(),
                    paymentOrder.getId(),
                    IpAddress);
        }
        if (paymentOrder.getPaymentMethod().getId() == 3L) {
            return paymentService.createMoMoPaymentUrl(
                    paymentOrder.getTotalPrice(),
                    "Thanh toan don hang #" + paymentOrder.getId(),
                    paymentOrder.getId());
        }

        throw new OrderValidException("Phương thức thanh toán không hỗ trợ retry");
    }

    @Override
    @Transactional
    public void expirePendingPayments() {
        Date cutoff = new Date(System.currentTimeMillis() - (pendingPaymentExpiryMinutes * 60 * 1000));
        List<Order> expiredOrders = orderRepository.findByStatusAndCreateAtBefore(OrderStatus.PENDING_PAYMENT, cutoff);
        for (Order order : expiredOrders) {
            releaseReservedStock(order);
            order.setStatus(OrderStatus.CANCELLED);
            orderRepository.save(order);

            if (order.getMasterOrder() != null && order.getMasterOrder()) {
                List<Order> childOrders = orderRepository.findByParentOrderIdOrderByCreateAtAsc(order.getId());
                for (Order child : childOrders) {
                    child.setStatus(OrderStatus.CANCELLED);
                    orderRepository.save(child);
                }
            }

            if (order.getUser() != null) {
                notificationService.send(order.getUser().getId(),
                        "Đơn hàng hết hạn thanh toán",
                        "Đơn hàng #" + order.getId() + " đã bị hủy do quá hạn thanh toán",
                        NotificationType.ORDER_CANCELLED,
                        order.getId());
                eventPublisher.publishOrderUpdate(order.getUser().getId(), order.getId(),
                        OrderStatus.CANCELLED.name(), "Đơn hàng hết hạn thanh toán");
            }
        }
    }

    private PreviewContext buildPreviewContext(Users user, String discountVoucherCode, String shippingVoucherCode,
                                               String deliveryType, String toDistrictId, String toWardCode,
                                               boolean consumeVoucherUsage) {
        Cart cart = user.getCart();
        if (cart == null || cart.getItems() == null || cart.getItems().isEmpty()) {
            throw new OrderValidException("Cart is empty");
        }

        String normalizedDistrictId = normalizeDistrictId(toDistrictId);
        String normalizedWardCode = (toWardCode == null || toWardCode.isBlank()) ? "21012" : toWardCode;

        BigDecimal subtotal = BigDecimal.ZERO;
        Set<OrderItem> orderItems = new HashSet<>();
        Set<CartItemDetailsResponseDTO> responseItems = new HashSet<>();
        List<String> shippingWarnings = new ArrayList<>();
        List<String> standardBlockedShops = new ArrayList<>();
        List<String> expressBlockedShops = new ArrayList<>();
        boolean canStandard = true;
        boolean canExpress = true;
        Map<Long, BigDecimal> standardShippingBySeller = new HashMap<>();
        Map<Long, BigDecimal> expressShippingBySeller = new HashMap<>();
        Map<Long, Set<OrderItem>> itemsBySeller = new LinkedHashMap<>();

        for (CartItem cartItem : cart.getItems()) {
            if (cartItem == null) continue;
            Product product = cartItem.getProduct();
            Long quantityBuy = cartItem.getQuantity();
            if (product == null || quantityBuy == null || quantityBuy <= 0) {
                throw new OrderValidException("Giỏ hàng chứa sản phẩm không hợp lệ");
            }
            if (product.getSeller() != null && product.getSeller().getId() != null
                    && product.getSeller().getId().equals(user.getId())) {
                throw new OrderValidException("Bạn không thể mua sản phẩm của chính shop mình");
            }
            if (product.getQuantity() == null || product.getQuantity() < quantityBuy) {
                throw new ProductQuantityValidation("Sản phẩm " + product.getProductName() + " đã hết hàng!");
            }

            BigDecimal currentPrice = product.getPrice();
            BigDecimal lineAmount = currentPrice.multiply(BigDecimal.valueOf(quantityBuy));
            subtotal = subtotal.add(lineAmount);

            OrderItem orderItem = new OrderItem();
            orderItem.setProduct(product);
            orderItem.setQuantity(quantityBuy);
            orderItem.setPrice(currentPrice);
            orderItems.add(orderItem);

            Long sellerId = product.getSeller() != null ? product.getSeller().getId() : null;
            if (sellerId == null) {
                throw new OrderValidException("Sản phẩm " + product.getProductName() + " chưa có thông tin nhà vườn");
            }
            itemsBySeller.computeIfAbsent(sellerId, key -> new LinkedHashSet<>()).add(orderItem);

            CartItemDetailsResponseDTO dto = new CartItemDetailsResponseDTO();
            dto.setProductId(product.getId());
            dto.setProductName(product.getProductName());
            dto.setPrice(currentPrice);
            dto.setQuantity(quantityBuy);
            dto.setImageUrl(product.getPrimaryImagePath() != null ? "/api/products/" + product.getId() + "/img" : null);
            responseItems.add(dto);
        }

        for (Map.Entry<Long, Set<OrderItem>> entry : itemsBySeller.entrySet()) {
            Long sellerId = entry.getKey();
            Users seller = userRepository.findById(sellerId)
                    .orElseThrow(() -> new ResourceNotFoundException("Seller not found"));
            String sellerName = resolveSellerDisplayName(seller);

            List<ShippingValidationResponse.ShippingOption> sellerOptions =
                    shippingValidationService.estimateShippingOptionsForSeller(
                            seller,
                            entry.getValue(),
                            normalizedDistrictId,
                            normalizedWardCode);

            Long standardFee = sellerOptions.stream()
                    .filter(this::isStandardOption)
                    .map(ShippingValidationResponse.ShippingOption::getFee)
                    .filter(Objects::nonNull)
                    .min(Long::compareTo)
                    .orElse(null);
            Long expressFee = sellerOptions.stream()
                    .filter(this::isExpressOption)
                    .map(ShippingValidationResponse.ShippingOption::getFee)
                    .filter(Objects::nonNull)
                    .min(Long::compareTo)
                    .orElse(null);

            if (standardFee == null) {
                canStandard = false;
                standardBlockedShops.add(sellerName);
            } else {
                standardShippingBySeller.put(sellerId, BigDecimal.valueOf(standardFee));
            }

            if (expressFee == null) {
                canExpress = false;
                expressBlockedShops.add(sellerName);
            } else {
                expressShippingBySeller.put(sellerId, BigDecimal.valueOf(expressFee));
            }
        }

        if (!standardBlockedShops.isEmpty()) {
            shippingWarnings.add("Giao tiêu chuẩn: Một số shop chưa hỗ trợ tuyến này (" + joinProductNames(standardBlockedShops) + ").");
        }
        if (!expressBlockedShops.isEmpty()) {
            shippingWarnings.add("Giao hỏa tốc: Một số shop chưa hỗ trợ tuyến này (" + joinProductNames(expressBlockedShops) + ").");
        }

        List<String> availableDeliveryTypes = new ArrayList<>();
        if (canStandard) {
            availableDeliveryTypes.add("STANDARD");
        }
        if (canExpress) {
            availableDeliveryTypes.add("EXPRESS");
        }
        if (availableDeliveryTypes.isEmpty()) {
            shippingWarnings.add("Gợi ý: Hãy đổi địa chỉ nhận hoặc xóa các sản phẩm nhạy cảm để tiếp tục đặt hàng.");

            BigDecimal discountAmount = resolveVoucherDiscount(discountVoucherCode, subtotal,
                    "Mã giảm giá", consumeVoucherUsage);
            BigDecimal shippingDiscountAmount = BigDecimal.ZERO;

            BigDecimal totalAmount = subtotal.subtract(discountAmount);
            if (totalAmount.compareTo(BigDecimal.ZERO) < 0) {
                totalAmount = BigDecimal.ZERO;
            }

            String fallbackDeliveryType = (deliveryType == null || deliveryType.isBlank())
                    ? "STANDARD"
                    : deliveryType.trim().toUpperCase(Locale.ROOT);

            OrderPreviewResponseDTO blockedPreview = new OrderPreviewResponseDTO();
            blockedPreview.setSubtotal(subtotal);
            blockedPreview.setShippingFee(BigDecimal.ZERO);
            blockedPreview.setDiscountAmount(discountAmount);
            blockedPreview.setShippingDiscountAmount(shippingDiscountAmount);
            blockedPreview.setTotalAmount(totalAmount);
            blockedPreview.setDeliveryType(fallbackDeliveryType);
            blockedPreview.setAvailableDeliveryTypes(availableDeliveryTypes);
            blockedPreview.setShippingWarnings(shippingWarnings);
            blockedPreview.setCanCheckout(false);

            return new PreviewContext(cart, orderItems, responseItems, blockedPreview);
        }

        String normalizedDeliveryType = normalizeDeliveryType(deliveryType, availableDeliveryTypes);
        boolean canCheckout = availableDeliveryTypes.contains(normalizedDeliveryType);

        BigDecimal standardShippingTotal = standardShippingBySeller.values().stream()
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal expressShippingTotal = expressShippingBySeller.values().stream()
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal shippingFee = "EXPRESS".equals(normalizedDeliveryType)
            ? expressShippingTotal
            : standardShippingTotal;
        BigDecimal discountAmount = resolveVoucherDiscount(discountVoucherCode, subtotal,
                "Mã giảm giá", consumeVoucherUsage);
        BigDecimal shippingDiscountAmount = resolveVoucherDiscount(shippingVoucherCode, shippingFee,
                "Mã freeship", consumeVoucherUsage);

        BigDecimal totalAmount = subtotal
                .add(shippingFee)
                .subtract(discountAmount)
                .subtract(shippingDiscountAmount);
        if (totalAmount.compareTo(BigDecimal.ZERO) < 0) {
            totalAmount = BigDecimal.ZERO;
        }

        OrderPreviewResponseDTO preview = new OrderPreviewResponseDTO();
        preview.setSubtotal(subtotal);
        preview.setShippingFee(shippingFee);
        preview.setDiscountAmount(discountAmount);
        preview.setShippingDiscountAmount(shippingDiscountAmount);
        preview.setTotalAmount(totalAmount);
        preview.setDeliveryType(normalizedDeliveryType);
        preview.setAvailableDeliveryTypes(availableDeliveryTypes);
        preview.setShippingWarnings(shippingWarnings);
        preview.setCanCheckout(canCheckout);

        return new PreviewContext(cart, orderItems, responseItems, preview);
    }

    private PreviewContext buildSingleItemPreviewContext(Users user, Long productId, Long quantity,
                                                         String discountVoucherCode, String shippingVoucherCode,
                                                         String deliveryType, String toDistrictId, String toWardCode,
                                                         boolean consumeVoucherUsage) {
        if (productId == null || productId <= 0) {
            throw new OrderValidException("Thiếu sản phẩm mua ngay");
        }
        if (quantity == null || quantity <= 0) {
            throw new OrderValidException("Số lượng mua ngay không hợp lệ");
        }

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
        if (product.getSeller() != null && product.getSeller().getId() != null
                && product.getSeller().getId().equals(user.getId())) {
            throw new OrderValidException("Bạn không thể mua sản phẩm của chính shop mình");
        }
        if (product.getQuantity() == null || product.getQuantity() < quantity) {
            throw new ProductQuantityValidation("Sản phẩm " + product.getProductName() + " đã hết hàng!");
        }

        String normalizedDistrictId = normalizeDistrictId(toDistrictId);
        String normalizedWardCode = (toWardCode == null || toWardCode.isBlank()) ? "21012" : toWardCode;

        BigDecimal subtotal = product.getPrice().multiply(BigDecimal.valueOf(quantity));

        OrderItem orderItem = new OrderItem();
        orderItem.setProduct(product);
        orderItem.setQuantity(quantity);
        orderItem.setPrice(product.getPrice());
        Set<OrderItem> orderItems = new HashSet<>();
        orderItems.add(orderItem);

        CartItemDetailsResponseDTO dto = new CartItemDetailsResponseDTO();
        dto.setProductId(product.getId());
        dto.setProductName(product.getProductName());
        dto.setPrice(product.getPrice());
        dto.setQuantity(quantity);
        dto.setImageUrl(product.getPrimaryImagePath() != null ? "/api/products/" + product.getId() + "/img" : null);
        Set<CartItemDetailsResponseDTO> responseItems = new HashSet<>();
        responseItems.add(dto);

        ShippingValidationResponse shippingValidation = shippingValidationService.validateShipping(
                product.getId(), normalizedDistrictId, normalizedWardCode);

        boolean canStandard = shippingValidation.getAvailableMethods().stream().anyMatch(this::isStandardOption);
        boolean canExpress = shippingValidation.getAvailableMethods().stream().anyMatch(this::isExpressOption);

        Long standardFee = shippingValidation.getAvailableMethods().stream()
                .filter(this::isStandardOption)
                .map(ShippingValidationResponse.ShippingOption::getFee)
                .filter(Objects::nonNull)
                .min(Long::compareTo)
                .orElse(null);

        Long expressFee = shippingValidation.getAvailableMethods().stream()
                .filter(this::isExpressOption)
                .map(ShippingValidationResponse.ShippingOption::getFee)
                .filter(Objects::nonNull)
                .min(Long::compareTo)
                .orElse(null);

        List<String> shippingWarnings = new ArrayList<>();
        List<String> availableDeliveryTypes = new ArrayList<>();
        if (canStandard) {
            availableDeliveryTypes.add("STANDARD");
        } else {
            shippingWarnings.add("Giao tiêu chuẩn: Không hỗ trợ " + product.getProductName() + " vì thời gian vận chuyển dài hơn hạn sử dụng.");
        }
        if (canExpress) {
            availableDeliveryTypes.add("EXPRESS");
        } else {
            shippingWarnings.add("Giao hỏa tốc: Không hỗ trợ " + product.getProductName() + " vì GHN hiện không cung cấp dịch vụ hỏa tốc cho tuyến giao này.");
        }

        if (availableDeliveryTypes.isEmpty()) {
            OrderPreviewResponseDTO blockedPreview = new OrderPreviewResponseDTO();
            BigDecimal discountAmount = resolveVoucherDiscount(discountVoucherCode, subtotal, "Mã giảm giá", consumeVoucherUsage);
            blockedPreview.setSubtotal(subtotal);
            blockedPreview.setShippingFee(BigDecimal.ZERO);
            blockedPreview.setDiscountAmount(discountAmount);
            blockedPreview.setShippingDiscountAmount(BigDecimal.ZERO);
            blockedPreview.setTotalAmount(subtotal.subtract(discountAmount).max(BigDecimal.ZERO));
            blockedPreview.setDeliveryType((deliveryType == null || deliveryType.isBlank()) ? "STANDARD" : deliveryType.trim().toUpperCase(Locale.ROOT));
            blockedPreview.setAvailableDeliveryTypes(availableDeliveryTypes);
            blockedPreview.setShippingWarnings(shippingWarnings);
            blockedPreview.setCanCheckout(false);
            return new PreviewContext(null, orderItems, responseItems, blockedPreview);
        }

        String normalizedDeliveryType = normalizeDeliveryType(deliveryType, availableDeliveryTypes);
        BigDecimal shippingFee = "EXPRESS".equals(normalizedDeliveryType)
                ? BigDecimal.valueOf(expressFee != null ? expressFee : 0L)
                : BigDecimal.valueOf(standardFee != null ? standardFee : 0L);
        BigDecimal discountAmount = resolveVoucherDiscount(discountVoucherCode, subtotal, "Mã giảm giá", consumeVoucherUsage);
        BigDecimal shippingDiscountAmount = resolveVoucherDiscount(shippingVoucherCode, shippingFee, "Mã freeship", consumeVoucherUsage);

        BigDecimal totalAmount = subtotal
                .add(shippingFee)
                .subtract(discountAmount)
                .subtract(shippingDiscountAmount);
        if (totalAmount.compareTo(BigDecimal.ZERO) < 0) {
            totalAmount = BigDecimal.ZERO;
        }

        OrderPreviewResponseDTO preview = new OrderPreviewResponseDTO();
        preview.setSubtotal(subtotal);
        preview.setShippingFee(shippingFee);
        preview.setDiscountAmount(discountAmount);
        preview.setShippingDiscountAmount(shippingDiscountAmount);
        preview.setTotalAmount(totalAmount);
        preview.setDeliveryType(normalizedDeliveryType);
        preview.setAvailableDeliveryTypes(availableDeliveryTypes);
        preview.setShippingWarnings(shippingWarnings);
        preview.setCanCheckout(true);

        return new PreviewContext(null, orderItems, responseItems, preview);
    }

    private BigDecimal resolveVoucherDiscount(String voucherCode, BigDecimal baseAmount, String label,
                                             boolean consumeVoucherUsage) {
        if (voucherCode == null || voucherCode.isBlank()) {
            return BigDecimal.ZERO;
        }
        
        // If voucher doesn't exist, just return 0 discount (don't throw error)
        Voucher voucher = voucherRepository.findByCode(voucherCode).orElse(null);
        if (voucher == null) {
            return BigDecimal.ZERO;
        }
        
        if (!voucher.isValid()) {
            throw new OrderValidException(label + " đã hết hạn hoặc hết lượt sử dụng");
        }
        BigDecimal discount = voucher.calculateDiscount(baseAmount);
        if (consumeVoucherUsage) {
            voucher.setUsedCount(voucher.getUsedCount() + 1);
            voucherRepository.save(voucher);
        }
        return discount;
    }

    private String normalizeDistrictId(String toDistrictId) {
        if (toDistrictId == null || toDistrictId.isBlank()) {
            return "1542";
        }
        return toDistrictId;
    }

    private String joinProductNames(List<String> names) {
        if (names == null || names.isEmpty()) {
            return "một số sản phẩm";
        }
        return String.join(", ", new LinkedHashSet<>(names));
    }

    private String normalizeDeliveryType(String deliveryType, List<String> availableDeliveryTypes) {
        String normalized = (deliveryType == null || deliveryType.isBlank())
                ? "STANDARD"
                : deliveryType.trim().toUpperCase(Locale.ROOT);
        if (!availableDeliveryTypes.contains(normalized)) {
            return availableDeliveryTypes.get(0);
        }
        return normalized;
    }

    private boolean isExpressOption(ShippingValidationResponse.ShippingOption option) {
        if (option == null) {
            return false;
        }
        Integer serviceTypeId = option.getServiceTypeId();
        if (serviceTypeId != null) {
            return serviceTypeId == 1;
        }
        return isExpressServiceName(option.getServiceName());
    }

    private boolean isStandardOption(ShippingValidationResponse.ShippingOption option) {
        if (option == null) {
            return false;
        }
        Integer serviceTypeId = option.getServiceTypeId();
        if (serviceTypeId != null) {
            return serviceTypeId == 2;
        }
        return !isExpressServiceName(option.getServiceName());
    }

    private boolean isExpressServiceName(String serviceName) {
        if (serviceName == null) {
            return false;
        }
        String normalized = serviceName.toLowerCase(Locale.ROOT);
        return normalized.contains("hỏa tốc") || normalized.contains("hoa toc") || normalized.contains("express");
    }

    private Set<OrderItem> cloneItemsForOrder(Set<OrderItem> sourceItems, Order targetOrder) {
        Set<OrderItem> cloned = new LinkedHashSet<>();
        for (OrderItem source : sourceItems) {
            OrderItem item = new OrderItem();
            item.setOrder(targetOrder);
            item.setProduct(source.getProduct());
            item.setQuantity(source.getQuantity());
            item.setPrice(source.getPrice());
            cloned.add(item);
        }
        return cloned;
    }

    private OrderSubOrderDTO toSubOrderDTO(Order order) {
        OrderSubOrderDTO dto = new OrderSubOrderDTO();
        dto.setId(order.getId());
        dto.setSellerId(order.getSeller() != null ? order.getSeller().getId() : null);
        String sellerName = null;
        if (order.getSeller() != null) {
            if (order.getSeller().getFullName() != null && !order.getSeller().getFullName().isBlank()) {
                sellerName = order.getSeller().getFullName();
            } else {
                sellerName = order.getSeller().getUsername();
            }
        }
        dto.setSellerName(sellerName);
        dto.setTotalPrice(order.getTotalPrice());
        dto.setShippingFee(order.getShippingFee());
        dto.setStatus(order.getStatus());
        if (order.getOrderItems() != null) {
            dto.setCartItems(order.getOrderItems().stream()
                    .map(orderMapper::toCartItemDetailsResponseDTO)
                    .collect(Collectors.toSet()));
        }
        return dto;
    }

    private Map<Long, BigDecimal> computeShippingFeeBySeller(Map<Long, Set<OrderItem>> itemsBySeller,
                                                              String deliveryType,
                                                              String toDistrictId,
                                                              String toWardCode) {
        String normalizedType = (deliveryType == null || deliveryType.isBlank())
                ? "STANDARD"
                : deliveryType.trim().toUpperCase(Locale.ROOT);
        Map<Long, BigDecimal> shippingBySeller = new HashMap<>();

        for (Map.Entry<Long, Set<OrderItem>> entry : itemsBySeller.entrySet()) {
            Users seller = userRepository.findById(entry.getKey())
                    .orElseThrow(() -> new ResourceNotFoundException("Seller not found"));

            List<ShippingValidationResponse.ShippingOption> sellerOptions =
                    shippingValidationService.estimateShippingOptionsForSeller(
                            seller,
                            entry.getValue(),
                            toDistrictId,
                            toWardCode);

            Long sellerFee = sellerOptions.stream()
                    .filter(option -> "EXPRESS".equals(normalizedType) ? isExpressOption(option) : isStandardOption(option))
                    .map(ShippingValidationResponse.ShippingOption::getFee)
                    .filter(Objects::nonNull)
                    .min(Long::compareTo)
                    .orElse(null);

            if (sellerFee == null) {
                throw new OrderValidException("Shop " + resolveSellerDisplayName(seller) + " không hỗ trợ phương thức giao hàng đã chọn");
            }
            shippingBySeller.put(entry.getKey(), BigDecimal.valueOf(sellerFee));
        }
        return shippingBySeller;
    }

    private boolean isOnlinePaymentMethod(PaymentMethod paymentMethod) {
        if (paymentMethod == null) {
            return false;
        }
        if (paymentMethod.getId() != null && (paymentMethod.getId() == 2L || paymentMethod.getId() == 3L)) {
            return true;
        }
        String methodName = paymentMethod.getMethodName();
        if (methodName == null) {
            return false;
        }
        String normalized = methodName.trim().toUpperCase(Locale.ROOT);
        return normalized.contains("VNPAY") || normalized.contains("MOMO");
    }

    private String resolvePaymentUrl(Order order, String ipAddress) {
        if (order == null || !isOnlinePaymentMethod(order.getPaymentMethod())) {
            return null;
        }
        Order paymentOrder = order;
        if (order.getParentOrder() != null && order.getParentOrder().getMasterOrder() != null
                && order.getParentOrder().getMasterOrder()) {
            paymentOrder = order.getParentOrder();
        }

        if (paymentOrder.getStatus() != OrderStatus.PENDING_PAYMENT || isPaymentExpired(paymentOrder)) {
            return null;
        }

        if (paymentOrder.getPaymentMethod() == null || paymentOrder.getPaymentMethod().getId() == null) {
            return null;
        }

        try {
            if (paymentOrder.getPaymentMethod().getId() == 2L) {
                return paymentService.createPaymentUrl(
                        paymentOrder.getTotalPrice(),
                        "Thanh toán đơn hàng #" + paymentOrder.getId(),
                        paymentOrder.getId(),
                        ipAddress);
            }
            if (paymentOrder.getPaymentMethod().getId() == 3L) {
                return paymentService.createMoMoPaymentUrl(
                        paymentOrder.getTotalPrice(),
                        "Thanh toan don hang #" + paymentOrder.getId(),
                        paymentOrder.getId());
            }
        } catch (Exception ignored) {
            return null;
        }
        return null;
    }

    private String resolveSellerDisplayName(Users seller) {
        if (seller == null) {
            return "Shop";
        }
        if (seller.getFullName() != null && !seller.getFullName().isBlank()) {
            return seller.getFullName();
        }
        if (seller.getUsername() != null && !seller.getUsername().isBlank()) {
            return seller.getUsername();
        }
        return "Shop #" + seller.getId();
    }

    private BigDecimal proportion(BigDecimal totalValue, BigDecimal part, BigDecimal denominator) {
        if (totalValue == null || part == null || denominator == null) {
            return BigDecimal.ZERO;
        }
        if (totalValue.compareTo(BigDecimal.ZERO) <= 0 || denominator.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        return totalValue.multiply(part)
                .divide(denominator, 2, java.math.RoundingMode.HALF_UP);
    }

    private void releaseReservedStock(Order order) {
        if (order == null || order.getOrderItems() == null) {
            return;
        }
        for (OrderItem item : order.getOrderItems()) {
            if (item.getProduct() == null || item.getQuantity() == null || item.getQuantity() <= 0) {
                continue;
            }
            productRepository.increaseStock(item.getProduct().getId(), item.getQuantity());
        }
    }

    private boolean isPaymentExpired(Order order) {
        if (order == null || order.getCreateAt() == null) {
            return true;
        }
        long ageMs = System.currentTimeMillis() - order.getCreateAt().getTime();
        return ageMs > (pendingPaymentExpiryMinutes * 60 * 1000);
    }

    private static class PreviewContext {
        private final Cart cart;
        private final Set<OrderItem> orderItems;
        private final Set<CartItemDetailsResponseDTO> responseItems;
        private final OrderPreviewResponseDTO preview;

        private PreviewContext(Cart cart, Set<OrderItem> orderItems,
                               Set<CartItemDetailsResponseDTO> responseItems,
                               OrderPreviewResponseDTO preview) {
            this.cart = cart;
            this.orderItems = orderItems;
            this.responseItems = responseItems;
            this.preview = preview;
        }
    }
}
