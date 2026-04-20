package com.trash.ecommerce.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Table(name = "conversation", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"buyer_id", "seller_id"})
})
public class Conversation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "buyer_id", nullable = false)
    private Users buyer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_id", nullable = false)
    private Users seller;

    @Column(name = "last_message", length = 500)
    private String lastMessage;

    @Column(name = "last_message_at")
    private LocalDateTime lastMessageAt;

    @Column(name = "buyer_unread", nullable = false)
    private Integer buyerUnread = 0;

    @Column(name = "seller_unread", nullable = false)
    private Integer sellerUnread = 0;

    @Column(name = "deleted_by_buyer", nullable = false)
    private Boolean deletedByBuyer = false;

    @Column(name = "deleted_by_seller", nullable = false)
    private Boolean deletedBySeller = false;

    @Column(name = "deleted_at_buyer")
    private LocalDateTime deletedAtBuyer;

    @Column(name = "deleted_at_seller")
    private LocalDateTime deletedAtSeller;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "conversation", cascade = CascadeType.ALL, orphanRemoval = true)
    private java.util.List<Message> messages;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.lastMessageAt = LocalDateTime.now();
    }
}
