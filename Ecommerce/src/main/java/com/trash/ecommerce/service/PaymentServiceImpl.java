package com.trash.ecommerce.service;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.trash.ecommerce.config.MoMoConfig;
import com.trash.ecommerce.config.PaymentHashGenerator;
import com.trash.ecommerce.config.VnPayConfig;
import com.trash.ecommerce.dto.PaymentMethodMessageResponse;
import com.trash.ecommerce.entity.*;
import com.trash.ecommerce.exception.OrderExistsException;
import com.trash.ecommerce.exception.PaymentException;
import com.trash.ecommerce.repository.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;

@Service
public class PaymentServiceImpl implements PaymentService {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private ProductRepository productRepository;
    @Autowired
    private PaymentMethodRepository paymentMethodRepository;
    @Autowired
    private VnPayConfig vnPayConfig;
    @Autowired
    private MoMoConfig moMoConfig;
    @Autowired
    private PaymentHashGenerator paymentHashGenerator;
    @Autowired
    private OrderRepository orderRepository;
    @Autowired
    private EmailService emailService;
    @Autowired
    private InvoiceService invoiceService;
    @Autowired
    private NotificationService notificationService;
    @Autowired
    private EventPublisher eventPublisher;

    @Value("${orders.pending-payment.expiry-minutes:15}")
    private long pendingPaymentExpiryMinutes;

    private Map<String, String> vnpayResponse(String code, String message) {
    return Map.of(
        "RspCode", code,
        "Message", message
    );}


    @Override
    public PaymentMethodMessageResponse addPaymentMethod(Long userId, String name) {
        userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        PaymentMethod paymentMethod = new PaymentMethod();
        paymentMethod.setMethodName(name);

        paymentMethodRepository.save(paymentMethod);

        return new PaymentMethodMessageResponse("success");
    }

    @Override
    public String createPaymentUrl(BigDecimal total_price, String orderInfo, Long orderId, String ipAddress) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderExistsException("Order not found"));
            String vnp_Version = "2.1.0";
            String vnp_Command = "pay";
            String vnp_OrderInfo = orderInfo;
            String orderType = "100000";
            String vnp_TxnRef = String.valueOf(order.getId());
            String vnp_IpAddr = ipAddress;
            String vnp_TmnCode = vnPayConfig.getTmnCode();

            String returnUrl = vnPayConfig.getReturnUrl();
            if (returnUrl == null || returnUrl.isBlank()) {
                returnUrl = "https://api.haquason.uk/api/payments/vnpay/return";
            }

            // Chuyển BigDecimal sang VND (nhân 100 và làm tròn)
            long amount = total_price.multiply(BigDecimal.valueOf(100)).longValue();
            Map<String, String> vnp_Params = new HashMap<>();
            vnp_Params.put("vnp_Version", vnp_Version);
            vnp_Params.put("vnp_Command", vnp_Command);
            vnp_Params.put("vnp_TmnCode", vnp_TmnCode);
            vnp_Params.put("vnp_Amount", String.valueOf(amount));
            vnp_Params.put("vnp_CurrCode", "VND");
            vnp_Params.put("vnp_TxnRef", vnp_TxnRef);
            vnp_Params.put("vnp_OrderInfo", vnp_OrderInfo);
            vnp_Params.put("vnp_OrderType", orderType);
            vnp_Params.put("vnp_Locale", "vn");
            vnp_Params.put("vnp_ReturnUrl", returnUrl);
            vnp_Params.put("vnp_IpAddr", vnp_IpAddr);

            ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
            String vnp_CreateDate = now.format(formatter);
            String vnp_ExpireDate = now.plusMinutes(15).format(formatter);

            vnp_Params.put("vnp_CreateDate", vnp_CreateDate);
            // Add Params of 2.1.0 Version
            vnp_Params.put("vnp_ExpireDate", vnp_ExpireDate);
            List<String> fieldNames = new ArrayList<>(vnp_Params.keySet());
            Collections.sort(fieldNames);
            StringBuilder hashData = new StringBuilder();
            StringBuilder query = new StringBuilder();
            Iterator<String> itr = fieldNames.iterator();
            while (itr.hasNext()) {
                String fieldName = itr.next();
                String fieldValue = vnp_Params.get(fieldName);
                if ((fieldValue != null) && (!fieldValue.isEmpty())) {
                    //Build hash data
                    hashData.append(fieldName);
                    hashData.append('=');
                    hashData.append(URLEncoder.encode(fieldValue, StandardCharsets.UTF_8));
                    //Build query
                    query.append(URLEncoder.encode(fieldName, StandardCharsets.UTF_8));
                    query.append('=');
                    query.append(URLEncoder.encode(fieldValue, StandardCharsets.UTF_8));
                    if (itr.hasNext()) {
                        query.append('&');
                        hashData.append('&');
                    }
                }
            }
            String queryUrl = query.toString();

            String vnp_SecureHash = paymentHashGenerator.HmacSHA512(vnPayConfig.getHashSecret(), hashData.toString());
            queryUrl += "&vnp_SecureHash=" + vnp_SecureHash;
        return vnPayConfig.getUrl() + "?" + queryUrl;
    }

    @Override
    public String createMoMoPaymentUrl(BigDecimal total_price, String orderInfo, Long orderId) {
        try {
            Order order = orderRepository.findById(orderId)
                    .orElseThrow(() -> new OrderExistsException("Order not found"));

            String partnerCode = moMoConfig.getPartnerCode();
            String accessKey = moMoConfig.getAccessKey();
            String secretKey = moMoConfig.getSecretKey();
            String requestId = String.valueOf(System.currentTimeMillis());
            String amount = String.valueOf(total_price.longValue());
            String orderIdStr = String.valueOf(orderId);
            String redirectUrl = moMoConfig.getReturnUrl();
            String ipnUrl = moMoConfig.getNotifyUrl();
            String extraData = "";
            String requestType = "captureWallet";
            
            // Remove Vietnamese accents and special characters for signature
            String orderInfoTho = "Thanh toan don hang " + orderIdStr;
            String safeExtraData = (extraData != null) ? extraData : "";
            // Build raw signature (alphabetical order, no URL encoding, use orderInfoTho without accents)
            String rawSignature = "accessKey=" + accessKey +
                    "&amount=" + amount +
                    "&extraData=" + extraData +
                    "&ipnUrl=" + ipnUrl +
                    "&orderId=" + orderIdStr +
                    "&orderInfo=" + orderInfoTho +
                    "&partnerCode=" + partnerCode +
                    "&redirectUrl=" + redirectUrl +
                    "&requestId=" + requestId +
                    "&requestType=" + requestType;

            // Generate HMAC-SHA256 signature
            String signature = generateHmacSHA256(rawSignature, secretKey);

            // Build JSON request (use orderInfoTho for consistency)
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("partnerCode", partnerCode);
            requestBody.put("accessKey", accessKey);
            requestBody.put("requestId", requestId);
            requestBody.put("amount", Long.parseLong(amount));
            requestBody.put("orderId", orderIdStr);
            requestBody.put("orderInfo", orderInfoTho);
            requestBody.put("redirectUrl", redirectUrl);
            requestBody.put("ipnUrl", ipnUrl);
            requestBody.put("lang", "vi");
            requestBody.put("extraData", extraData);
            requestBody.put("requestType", requestType);
            requestBody.put("signature", signature);

            // Call MoMo API
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            RestTemplate restTemplate = new RestTemplate();
            Map<String, Object> response = restTemplate.postForObject(moMoConfig.getEndpoint(), entity, Map.class);

            if (response != null && "0".equals(response.get("resultCode"))) {
                return (String) response.get("payUrl");
            } else {
                throw new PaymentException("MoMo payment creation failed: " + response);
            }
        } catch (Exception e) {
            throw new PaymentException("Error creating MoMo payment: " + e.getMessage());
        }
    }

    private String generateHmacSHA256(String data, String key) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    SecretKeySpec secretKeySpec = new SecretKeySpec(
        key.getBytes(StandardCharsets.UTF_8),  // ← phải là UTF-8
        "HmacSHA256"
    );
        mac.init(secretKeySpec);
        byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8)); // ← UTF-8
        
        // Chuyển sang hex string (lowercase)
        StringBuilder hexString = new StringBuilder();
        for (byte b : hash) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) hexString.append('0');
            hexString.append(hex);
        }
        return hexString.toString();
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }

    @Override
    public PaymentMethodMessageResponse handleMoMoReturn(HttpServletRequest request) {
        try {
            String partnerCode = request.getParameter("partnerCode");
            String accessKey = request.getParameter("accessKey");
            String requestId = request.getParameter("requestId");
            String amount = request.getParameter("amount");
            String orderId = request.getParameter("orderId");
            String orderInfo = request.getParameter("orderInfo");
            String orderType = request.getParameter("orderType");
            String transId = request.getParameter("transId");
            String resultCode = request.getParameter("resultCode");
            String message = request.getParameter("message");
            String payType = request.getParameter("payType");
            String responseTime = request.getParameter("responseTime");
            String extraData = request.getParameter("extraData");
            String signature = request.getParameter("signature");

            // Build raw signature for verification
            String rawSignature = "accessKey=" + accessKey +
                    "&amount=" + amount +
                    "&extraData=" + extraData +
                    "&message=" + message +
                    "&orderId=" + orderId +
                    "&orderInfo=" + orderInfo +
                    "&orderType=" + orderType +
                    "&partnerCode=" + partnerCode +
                    "&payType=" + payType +
                    "&requestId=" + requestId +
                    "&responseTime=" + responseTime +
                    "&resultCode=" + resultCode +
                    "&transId=" + transId;

            String expectedSignature = generateHmacSHA256(rawSignature, moMoConfig.getSecretKey());

            if (!expectedSignature.equals(signature)) {
                return new PaymentMethodMessageResponse("Invalid signature");
            }

            if ("0".equals(resultCode)) {
                return new PaymentMethodMessageResponse("Thanh toán MoMo thành công");
            } else {
                return new PaymentMethodMessageResponse("Thanh toán MoMo thất bại: " + message);
            }
        } catch (Exception e) {
            return new PaymentMethodMessageResponse("Lỗi xử lý thanh toán MoMo: " + e.getMessage());
        }
    }

    @Override
    public Map<String, String> handleMoMoNotify(HttpServletRequest request) {
        try {
            // Similar to return but for IPN
            String partnerCode = request.getParameter("partnerCode");
            String accessKey = request.getParameter("accessKey");
            String requestId = request.getParameter("requestId");
            String amount = request.getParameter("amount");
            String orderId = request.getParameter("orderId");
            String orderInfo = request.getParameter("orderInfo");
            String orderType = request.getParameter("orderType");
            String transId = request.getParameter("transId");
            String resultCode = request.getParameter("resultCode");
            String message = request.getParameter("message");
            String payType = request.getParameter("payType");
            String responseTime = request.getParameter("responseTime");
            String extraData = request.getParameter("extraData");
            String signature = request.getParameter("signature");

            String rawSignature = "accessKey=" + accessKey +
                    "&amount=" + amount +
                    "&extraData=" + extraData +
                    "&message=" + message +
                    "&orderId=" + orderId +
                    "&orderInfo=" + orderInfo +
                    "&orderType=" + orderType +
                    "&partnerCode=" + partnerCode +
                    "&payType=" + payType +
                    "&requestId=" + requestId +
                    "&responseTime=" + responseTime +
                    "&resultCode=" + resultCode +
                    "&transId=" + transId;

            String expectedSignature = generateHmacSHA256(rawSignature, moMoConfig.getSecretKey());

            if (!expectedSignature.equals(signature)) {
                return Map.of("RspCode", "97", "Message", "Invalid signature");
            }

            if ("0".equals(resultCode)) {
                // Process successful payment
                Order order = orderRepository.findById(Long.valueOf(orderId))
                        .orElseThrow(() -> new OrderExistsException("Order not found"));
                // Update order status if needed
                return Map.of("RspCode", "00", "Message", "Success");
            } else {
                return Map.of("RspCode", "99", "Message", "Payment failed");
            }
        } catch (Exception e) {
            return Map.of("RspCode", "99", "Message", "Error: " + e.getMessage());
        }
    }

    @Override
    public Map<String, String> hashFields(HttpServletRequest request) {
        Map<String, String> fields = new TreeMap<>();
        Iterator<String> params = request.getParameterNames().asIterator();
        while (params.hasNext()) {
            String fieldName = params.next();
            String fieldValue = request.getParameter(fieldName);
            if ((fieldValue != null) && (!fieldValue.isEmpty())) {
                fields.put(fieldName, fieldValue);
            }
        }

        fields.remove("vnp_SecureHashType");
        fields.remove("vnp_SecureHash");
        return fields;
    }

    @Override
    public PaymentMethodMessageResponse handleProcedureUserInterface(HttpServletRequest request) {
        Map<String, String> fields = hashFields(request);
        String vnp_SecureHash = request.getParameter("vnp_SecureHash");
        String signValue = paymentHashGenerator.hashAllFields(fields);
        if (signValue.equals(vnp_SecureHash)) {
            if ("00".equals(request.getParameter("vnp_ResponseCode"))) {
                return new PaymentMethodMessageResponse("GD Thanh cong");
            } else {
                return new PaymentMethodMessageResponse("GD Khong thanh cong");
            }

        } else {
            return new PaymentMethodMessageResponse("Chu ky khong hop le");
        }
    }

    @Override
    public Map<String, String> handleProcedurePayment(HttpServletRequest request) {
        Map<String, String> fields = hashFields(request);
        String vnp_SecureHash = request.getParameter("vnp_SecureHash");
        String signValue = paymentHashGenerator.hashAllFields(fields);
        if (signValue.equals(vnp_SecureHash))
        {

            String txnRef = fields.get("vnp_TxnRef");
            if (txnRef == null || txnRef.isEmpty()) {
                return vnpayResponse("03", "Invalid transaction reference");
            }
            
            Order order = orderRepository.findById(Long.valueOf(txnRef))
                    .orElseThrow(() -> new OrderExistsException("Order not found"));
            
            if (order.getUser() == null) {
                return vnpayResponse("05", "Order user not found");
            }
            
            Long orderId = order.getId();
            String vnpAmountStr = fields.get("vnp_Amount");
            if (vnpAmountStr == null || vnpAmountStr.isEmpty()) {
                return vnpayResponse("06", "Invalid amount");
            }
            
            long vnpAmountLong = Long.parseLong(vnpAmountStr);
            BigDecimal vnpAmount = BigDecimal.valueOf(vnpAmountLong).divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
            if (order.getTotalPrice() == null) {
                return vnpayResponse("07", "Order total price is null");
            }
            // So sánh BigDecimal bằng compareTo để tránh vấn đề precision
            boolean checkAmount = order.getTotalPrice().compareTo(vnpAmount) == 0;
            boolean checkOrderStatus = order.getStatus() == OrderStatus.PENDING_PAYMENT;


            if(order.getId() != null)
            {
                if(checkAmount)
                {
                    if (checkOrderStatus)
                    {
                        if ("00".equals(request.getParameter("vnp_ResponseCode")))
                        {
                            if (isPaymentExpired(order)) {
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
                                return vnpayResponse("10", "Payment expired");
                            }

                            Users user = order.getUser();
                            if (user == null) {
                                throw new PaymentException("User not found for order");
                            }
                            Long userId = user.getId();
                            order.setStatus(OrderStatus.PAID);

                            orderRepository.save(order);

                            if (order.getMasterOrder() != null && order.getMasterOrder()) {
                                List<Order> childOrders = orderRepository.findByParentOrderIdOrderByCreateAtAsc(order.getId());
                                for (Order child : childOrders) {
                                    if (child.getStatus() == OrderStatus.PENDING_PAYMENT) {
                                        child.setStatus(OrderStatus.PAID);
                                        orderRepository.save(child);
                                    }
                                }
                            }
                            String subject = "Confirm the order transaction";
                            String body = String.format(
                                    "Hi %s!\n\n" +
                                            "We’ve successfully received your order #%s, and it’s now on its way to your doorstep " +
                                            "(unless the universe decides to play tricks, but let’s hope not 😅).\n\n" +
                                            "Get ready to enjoy your purchase soon! If anything goes wrong, don’t worry — our team is armed " +
                                            "with coffee and a few clicks of magic 💻☕.\n\n" +
                                            "Thanks for choosing us and placing your order — you just helped us secure our morning caffeine fix!\n\n" +
                                            "Cheers,\n" +
                                            "The Shop Team",
                                    user.getEmail(), orderId
                            );
                            emailService.sendEmail(user.getEmail(), subject, body);
                            if (order.getPaymentMethod() == null) {
                                throw new PaymentException("Payment method not found for order");
                            }

                            if (order.getMasterOrder() != null && order.getMasterOrder()) {
                                List<Order> childOrders = orderRepository.findByParentOrderIdOrderByCreateAtAsc(order.getId());
                                for (Order child : childOrders) {
                                    if (child.getInvoice() == null) {
                                        invoiceService.createInvoice(userId, child.getId(), order.getPaymentMethod().getId());
                                    }
                                }
                            } else if (order.getInvoice() == null) {
                                invoiceService.createInvoice(userId, orderId, order.getPaymentMethod().getId());
                            }

                            // Notify buyer about successful payment
                            notificationService.send(userId,
                                    "Thanh to\u00e1n th\u00e0nh c\u00f4ng",
                                    "\u0110\u01a1n h\u00e0ng #" + orderId + " \u0111\u00e3 \u0111\u01b0\u1ee3c thanh to\u00e1n qua VNPay",
                                    NotificationType.ORDER_PLACED,
                                    orderId);
                            eventPublisher.publishOrderUpdate(userId, orderId,
                                    "PAID", "Thanh to\u00e1n th\u00e0nh c\u00f4ng");

                            // Notify sellers about paid order
                            List<Order> sellerOrders = (order.getMasterOrder() != null && order.getMasterOrder())
                                    ? orderRepository.findByParentOrderIdOrderByCreateAtAsc(order.getId())
                                    : List.of(order);
                            for (Order sellerOrder : sellerOrders) {
                                if (sellerOrder.getSeller() != null) {
                                    notificationService.send(sellerOrder.getSeller().getId(),
                                            "\u0110\u01a1n h\u00e0ng #" + sellerOrder.getId() + " \u0111\u00e3 thanh to\u00e1n",
                                            "Kh\u00e1ch h\u00e0ng " + user.getFullName() + " \u0111\u00e3 thanh to\u00e1n \u0111\u01a1n h\u00e0ng",
                                            NotificationType.ORDER_PLACED,
                                            sellerOrder.getId());
                                }
                            }
                        }
                        else
                        {
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
                            return vnpayResponse("24", "Transaction failed");
                        }
                        return vnpayResponse("01","Confirm Success");
                    }
                    else
                    {
                        return vnpayResponse("02","Order already confirmed");
                    }
                }
                else
                {
                    return vnpayResponse("04","Invalid Amount");
                }
            }
            else
            {
                return vnpayResponse("01","Order not Found");
            }
        }
        else
        {
            return vnpayResponse("97","Invalid Checksum");
        }
    }

    private boolean isPaymentExpired(Order order) {
        if (order == null || order.getCreateAt() == null) {
            return true;
        }
        long ageMs = System.currentTimeMillis() - order.getCreateAt().getTime();
        return ageMs > (pendingPaymentExpiryMinutes * 60 * 1000);
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
}
