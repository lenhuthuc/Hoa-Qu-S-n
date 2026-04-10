package com.trash.ecommerce.service;

import java.math.BigDecimal;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import com.trash.ecommerce.dto.OrderSummaryDTO;
import com.trash.ecommerce.entity.*;
import com.trash.ecommerce.exception.*;
import com.trash.ecommerce.mapper.OrderMapper;
import com.trash.ecommerce.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
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
    
    public OrderServiceImpl(UserRepository userRepository, OrderRepository orderRepository, PaymentService paymentService, InvoiceService invoiceService, PaymentMethodRepository paymentMethodRepository, CartRepository cartRepository, OrderMapper orderMapper, ProductRepository productRepository, NotificationService notificationService, EventPublisher eventPublisher, EmailService emailService) {
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
        this.paymentMethodRepository = paymentMethodRepository;
        this.cartRepository = cartRepository;
        this.paymentService = paymentService;
        this.invoiceService = invoiceService;
        this.orderMapper = orderMapper;
        this.productRepository = productRepository;
        this.notificationService = notificationService;
        this.eventPublisher = eventPublisher;
        this.emailService = emailService;
    }

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

    @Autowired
    private VoucherRepository voucherRepository;

    @Override
    @Transactional
    public OrderResponseDTO createMyOrder(Long userId, Long paymentMethodId, String voucherCode, String IpAddress) {
        Users user = userRepository.findById(userId)
                .orElseThrow(() -> new FindingUserError("User not found"));

        Cart cart = user.getCart();
        if (cart == null || cart.getItems() == null || cart.getItems().isEmpty()) {
            throw new OrderValidException("Cart is empty");
        }

        PaymentMethod paymentMethod = paymentMethodRepository.findById(paymentMethodId)
                .orElseThrow(() -> new PaymentException("Payment method not found"));

        com.trash.ecommerce.entity.Address address = user.getAddress();
        if (address == null) {
            throw new OrderValidException("User address is required to create an order");
        }

        BigDecimal totalPrice = BigDecimal.ZERO;
        Set<OrderItem> orderItems = new HashSet<>();
        Set<CartItemDetailsResponseDTO> responseItems = new HashSet<>();

        // 1. Basic Business Validation: Stock check
        for (CartItem cartItem : cart.getItems()) {
            if (cartItem == null) continue;
            Product product = cartItem.getProduct();
            Long quantityBuy = cartItem.getQuantity();

            if (product.getQuantity() == null || product.getQuantity() < quantityBuy) {
                throw new ProductQuantityValidation("Sản phẩm " + product.getProductName() + " đã hết hàng!");
            }
            
            BigDecimal currentPrice = product.getPrice();
            BigDecimal lineAmount = currentPrice.multiply(BigDecimal.valueOf(quantityBuy));
            totalPrice = totalPrice.add(lineAmount);

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
        }

        // 2 & 3. Pricing Engine: Voucher & Shipping
        BigDecimal discount = BigDecimal.ZERO;
        if (voucherCode != null && !voucherCode.isBlank()) {
            Voucher voucher = voucherRepository.findByCode(voucherCode)
                    .orElseThrow(() -> new OrderValidException("Mã giảm giá không hợp lệ"));
            if (!voucher.isValid()) {
                throw new OrderValidException("Mã giảm giá đã hết hạn hoặc hết lượt sử dụng");
            }
            discount = voucher.calculateDiscount(totalPrice);
            voucher.setUsedCount(voucher.getUsedCount() + 1);
            voucherRepository.save(voucher);
        }

        // Calculation: Total = (Price * Qty) + Shipping - Discount
        BigDecimal shippingFee = totalPrice.compareTo(BigDecimal.valueOf(500000)) >= 0
                ? BigDecimal.ZERO : BigDecimal.valueOf(30000);
        
        BigDecimal finalTotal = totalPrice.add(shippingFee).subtract(discount);
        if (finalTotal.compareTo(BigDecimal.ZERO) < 0) finalTotal = BigDecimal.ZERO;

        // 4 & 5. Payment & Order Initialization
        Order order = new Order();
        order.setCreateAt(new Date());
        order.setUser(user);
        order.setPaymentMethod(paymentMethod);
        order.setAddress(address);
        order.setTotalPrice(finalTotal);
        order.setShippingFee(shippingFee);
        // discount could be stored in a 'discount' field if it existed, but we subtract it from total
        
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

        // Deduct stock for COD or Instant payments
        if (paymentMethod.getId() == 1L) {
            for (OrderItem orderItem : orderItems) {
                productRepository.decreaseStock(orderItem.getProduct().getId(), orderItem.getQuantity());
            }
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
                shippingFee,
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
}
