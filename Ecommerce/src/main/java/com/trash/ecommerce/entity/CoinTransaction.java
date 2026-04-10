package com.trash.ecommerce.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Table(name = "coin_transaction")
public class CoinTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private Users user;

    @Column(name = "amount", nullable = false)
    private Integer amount;

    @Column(name = "type", nullable = false, length = 30)
    private String type; // REVIEW_REWARD, ORDER_REWARD, REFERRAL_REWARD, VOUCHER_REDEEM

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
