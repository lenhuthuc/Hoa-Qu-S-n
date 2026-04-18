package com.trash.ecommerce.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import com.trash.ecommerce.dto.OrderPreviewResponseDTO;
import com.trash.ecommerce.dto.OrderSummaryDTO;
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
                        String url = null;
                        if (order.getStatus() != null && 
                            order.getStatus() == OrderStatus.PENDING_PAYMENT && 
                            order.getPaymentMethod() != null && 
                            order.getPaymentMethod().getId() != null &&
                            order.getPaymentMethod().getId() == 2L) {
                            url = paymentService.createPaymentUrl(order.getTotalPrice(), ".", order.getId(), ipAddress);
                        }
                        return orderMapper.toOrderSummaryDTO(order, url);
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
            List<Product> sellerProducts = productRepository.findBySellerId(userId);
            Set<Long> sellerProductIds = sellerProducts.stream().map(Product::getId).collect(Collectors.toSet());
            isSeller = order.getOrderItems().stream()
                    .anyMatch(oi -> sellerProductIds.contains(oi.getProduct().getId()));
        }
        if (!isBuyer && !isSeller) {
            throw new AccessDeniedException("You do not have permission to view this order");
        }

        String paymentUrl = null;
        if (order.getPaymentMethod() != null && 
            order.getPaymentMethod().getId() != null &&
            order.getPaymentMethod().getId() == 2L && 
            order.getStatus() == OrderStatus.PENDING_PAYMENT) {
            paymentUrl = paymentService.createPaymentUrl(order.getTotalPrice(), ".", order.getId(), IpAddress);
        }

        OrderResponseDTO dto = orderMapper.toOrderResponseDTO(order, paymentUrl);
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
        public OrderResponseDTO createMyOrder(Long userId, Long paymentMethodId, String discountVoucherCode,
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
        Set<CartItemDetailsResponseDTO> responseItems = previewContext.responseItems;

        PaymentMethod paymentMethod = paymentMethodRepository.findById(paymentMethodId)
                .orElseThrow(() -> new PaymentException("Payment method not found"));

        com.trash.ecommerce.entity.Address address = user.getAddress();
        if (address == null) {
            throw new OrderValidException("User address is required to create an order");
        }

        // 4 & 5. Payment & Order Initialization
        Order order = new Order();
        order.setCreateAt(new Date());
        order.setUser(user);
        order.setPaymentMethod(paymentMethod);
        order.setAddress(address);
        order.setTotalPrice(previewContext.preview.getTotalAmount());
        order.setShippingFee(previewContext.preview.getShippingFee().subtract(previewContext.preview.getShippingDiscountAmount()));
        
        if (paymentMethod.getId() == 2L) {
            order.setStatus(OrderStatus.PENDING_PAYMENT);
        } else {
            order.setStatus(OrderStatus.PLACED);
        }
        
        orderRepository.save(order);
        
        // Link items to order
        for(OrderItem item : orderItems) {
            item.setOrder(order);
        }
        order.setOrderItems(orderItems);
        orderRepository.save(order);

        // Reserve stock for both COD and online payments.
        for (OrderItem orderItem : orderItems) {
            int updatedRows = productRepository.decreaseStock(orderItem.getProduct().getId(), orderItem.getQuantity());
            if (updatedRows == 0) {
                throw new ProductQuantityValidation("Sản phẩm " + orderItem.getProduct().getProductName() + " đã hết hàng!");
            }
        }

        if (paymentMethod.getId() == 1L && order.getInvoice() == null) {
            invoiceService.createInvoice(userId, order.getId(), paymentMethodId);
        }

        // 6. Notifications
        cartRepository.deleteCartItems(cart.getId());
        
        // Notify sellers
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
                order.getOrderNumber(),
                responseItems,
                order.getTotalPrice(),
            order.getShippingFee(),
                order.getStatus(),
                address.getFullAddress(),
                (paymentMethodId == 1) ? null : paymentService.createPaymentUrl(order.getTotalPrice(), ".", order.getId(), IpAddress),
                order.getCreateAt(),
                paymentMethod.getMethodName(),
                "BUYER"
        );
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

        com.trash.ecommerce.entity.Address address = user.getAddress();
        if (address == null) {
            throw new OrderValidException("User address is required to create an order");
        }

        Order order = new Order();
        order.setCreateAt(new Date());
        order.setUser(user);
        order.setPaymentMethod(paymentMethod);
        order.setAddress(address);
        order.setTotalPrice(previewContext.preview.getTotalAmount());
        order.setShippingFee(previewContext.preview.getShippingFee().subtract(previewContext.preview.getShippingDiscountAmount()));
        if (paymentMethod.getId() == 2L) {
            order.setStatus(OrderStatus.PENDING_PAYMENT);
        } else {
            order.setStatus(OrderStatus.PLACED);
        }
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

        if (paymentMethod.getId() == 1L && order.getInvoice() == null) {
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
                order.getOrderNumber(),
                previewContext.responseItems,
                order.getTotalPrice(),
                order.getShippingFee(),
                order.getStatus(),
                address.getFullAddress(),
                (paymentMethodId == 1) ? null : paymentService.createPaymentUrl(order.getTotalPrice(), ".", order.getId(), IpAddress),
                order.getCreateAt(),
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

        // Notify sellers about cancellation
        if (order.getOrderItems() != null) {
            Set<Long> notifiedSellers = new HashSet<>();
            for (OrderItem oi : order.getOrderItems()) {
                if (oi.getProduct() != null && oi.getProduct().getSeller() != null) {
                    Long sellerId = oi.getProduct().getSeller().getId();
                    if (notifiedSellers.add(sellerId)) {
                        notificationService.send(sellerId,
                                "Đơn hàng #" + orderId + " đã bị hủy",
                                "Người mua đã hủy đơn hàng #" + orderId,
                                NotificationType.ORDER_CANCELLED,
                                orderId);
                    }
                }
            }
        }
        eventPublisher.publishOrderUpdate(userId, orderId, "CANCELLED", "Đơn hàng đã bị hủy");

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
            List<Product> sellerProducts = productRepository.findBySellerId(userId);
            Set<Long> sellerProductIds = sellerProducts.stream().map(Product::getId).collect(Collectors.toSet());
            isSeller = order.getOrderItems().stream()
                    .anyMatch(oi -> sellerProductIds.contains(oi.getProduct().getId()));
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
            if (newStatus == OrderStatus.FINISHED && current != OrderStatus.SHIPPED) {
                throw new OrderValidException("Can only confirm receipt when order is being shipped");
            }
            if (newStatus == OrderStatus.CANCELLED) {
                if (current != OrderStatus.PLACED && current != OrderStatus.PENDING
                        && current != OrderStatus.PENDING_PAYMENT && current != OrderStatus.PREPARING) {
                    throw new OrderValidException("Cannot cancel order in current status: " + current);
                }
            }
        }

        order.setStatus(newStatus);
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
            Set<Long> notifiedSellers = new HashSet<>();
            for (OrderItem oi : order.getOrderItems()) {
                if (oi.getProduct() != null && oi.getProduct().getSeller() != null) {
                    Long sellerId = oi.getProduct().getSeller().getId();
                    if (notifiedSellers.add(sellerId)) {
                        String msg = newStatus == OrderStatus.FINISHED
                                ? "Người mua đã xác nhận nhận hàng đơn #" + orderId
                                : "Người mua đã hủy đơn hàng #" + orderId;
                        NotificationType type = newStatus == OrderStatus.FINISHED
                                ? NotificationType.ORDER_COMPLETED : NotificationType.ORDER_CANCELLED;
                        notificationService.send(sellerId, "Cập nhật đơn hàng #" + orderId, msg, type, orderId);
                    }
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
        if (order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            throw new OrderValidException("Order is not waiting for payment");
        }
        if (isPaymentExpired(order)) {
            releaseReservedStock(order);
            order.setStatus(OrderStatus.CANCELLED);
            orderRepository.save(order);
            throw new OrderValidException("Đơn hàng đã hết hạn thanh toán");
        }
        return paymentService.createPaymentUrl(order.getTotalPrice(), ".", order.getId(), IpAddress);
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
        List<String> standardBlockedProducts = new ArrayList<>();
        List<String> expressBlockedProducts = new ArrayList<>();
        boolean canStandard = true;
        boolean canExpress = true;
        BigDecimal standardShippingTotal = BigDecimal.ZERO;
        BigDecimal expressShippingTotal = BigDecimal.ZERO;

        for (CartItem cartItem : cart.getItems()) {
            if (cartItem == null) continue;
            Product product = cartItem.getProduct();
            Long quantityBuy = cartItem.getQuantity();
            if (product == null || quantityBuy == null || quantityBuy <= 0) {
                throw new OrderValidException("Giỏ hàng chứa sản phẩm không hợp lệ");
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

            CartItemDetailsResponseDTO dto = new CartItemDetailsResponseDTO();
            dto.setProductId(product.getId());
            dto.setProductName(product.getProductName());
            dto.setPrice(currentPrice);
            dto.setQuantity(quantityBuy);
            dto.setImageUrl(product.getPrimaryImagePath() != null ? "/api/products/" + product.getId() + "/img" : null);
            responseItems.add(dto);

            ShippingValidationResponse shippingValidation = shippingValidationService.validateShipping(
                    product.getId(), normalizedDistrictId, normalizedWardCode);
            boolean itemHasStandard = shippingValidation.getAvailableMethods().stream()
                    .anyMatch(this::isStandardOption);
            boolean itemHasExpress = shippingValidation.getAvailableMethods().stream()
                    .anyMatch(this::isExpressOption);

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

            if (!itemHasStandard) {
                canStandard = false;
                standardBlockedProducts.add(product.getProductName());
                } else if (standardFee != null) {
                standardShippingTotal = standardShippingTotal.add(BigDecimal.valueOf(standardFee));
            }
            if (!itemHasExpress) {
                canExpress = false;
                expressBlockedProducts.add(product.getProductName());
                } else if (expressFee != null) {
                expressShippingTotal = expressShippingTotal.add(BigDecimal.valueOf(expressFee));
            }
        }

        if (!standardBlockedProducts.isEmpty()) {
            shippingWarnings.add("Giao tiêu chuẩn: Không hỗ trợ " + joinProductNames(standardBlockedProducts)
                    + " vì thời gian vận chuyển dài hơn hạn sử dụng.");
        }
        if (!expressBlockedProducts.isEmpty()) {
            shippingWarnings.add("Giao hỏa tốc: Không hỗ trợ " + joinProductNames(expressBlockedProducts)
                    + " vì GHN hiện không cung cấp dịch vụ hỏa tốc cho tuyến giao này.");
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
