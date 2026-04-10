package com.trash.ecommerce.entity;

import java.math.BigDecimal;
import java.util.Date;
import java.util.HashSet;
import java.util.Set;

import jakarta.persistence.*;
import lombok.*;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Table(name = "orders")
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    @Column(name = "id")
    private Long id;
    @Column(name = "status") 
    @Enumerated(EnumType.STRING)
    private OrderStatus status;
    @Column(name = "total_price",nullable = false, precision = 12, scale = 2)
    private BigDecimal totalPrice;
    @Column(name = "shipping_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal shippingFee = BigDecimal.ZERO;
    @Column(name = "created_at")
    private Date createAt;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private Users user;

    @OneToMany(
        fetch = FetchType.LAZY,
        cascade = CascadeType.ALL,
        mappedBy = "order"
    )
    private Set<OrderItem> orderItems = new HashSet<>();

    @OneToOne(
            cascade = CascadeType.ALL,
            mappedBy = "order"
    )
    private Invoice invoice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_id")
    private PaymentMethod paymentMethod;

    @ManyToOne(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinColumn(name = "address_id")
    private Address address;

    @Column(name = "order_number", length = 30)
    private String orderNumber;

    @PrePersist
    protected void onCreate() {
        this.createAt = new Date();
        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyyMMdd");
        String datePart = sdf.format(this.createAt);
        // We use a random suffix as we don't have the final ID yet in PrePersist
        this.orderNumber = "ORD-" + datePart + "-" + (int)(Math.random() * 900 + 100);
    }
}
