package com.trash.ecommerce.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "seller_applications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SellerApplication {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private Users user;

    @Column(name = "shop_name", nullable = false, length = 60)
    private String shopName;

    @Column(name = "contact_email", nullable = false, length = 120)
    private String contactEmail;

    @Column(name = "contact_phone", nullable = false, length = 20)
    private String contactPhone;

    @Column(name = "pickup_address", nullable = false, length = 255)
    private String pickupAddress;

    @Column(name = "shipping_provider", nullable = false, length = 50)
    private String shippingProvider = "GHN";

    @Enumerated(EnumType.STRING)
    @Column(name = "seller_type", nullable = false, length = 20)
    private SellerType sellerType;

    @Column(name = "tax_code", length = 30)
    private String taxCode;

    @Column(name = "business_name", length = 160)
    private String businessName;

    @Column(name = "business_address", length = 255)
    private String businessAddress;

    @Column(name = "business_license_url", length = 1000)
    private String businessLicenseUrl;

    @Column(name = "food_safety_document_type", length = 50)
    private String foodSafetyDocumentType;

    @Column(name = "food_safety_document_url", length = 1000)
    private String foodSafetyDocumentUrl;

    @Column(name = "identity_full_name", nullable = false, length = 150)
    private String identityFullName;

    @Column(name = "identity_number", nullable = false, length = 30)
    private String identityNumber;

    @Column(name = "identity_issue_date")
    private LocalDate identityIssueDate;

    @Column(name = "identity_issue_place", length = 160)
    private String identityIssuePlace;

    @Column(name = "id_card_front_url", nullable = false, length = 1000)
    private String idCardFrontUrl;

    @Column(name = "id_card_back_url", nullable = false, length = 1000)
    private String idCardBackUrl;

    @Column(name = "agreed_to_terms", nullable = false)
    private Boolean agreedToTerms = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private SellerApplicationStatus status = SellerApplicationStatus.DRAFT;

    @Column(name = "review_note", length = 1000)
    private String reviewNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private Users reviewedBy;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}