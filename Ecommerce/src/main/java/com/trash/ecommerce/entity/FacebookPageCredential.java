package com.trash.ecommerce.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "facebook_page_credentials", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"seller_id", "page_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class FacebookPageCredential {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "seller_id", nullable = false)
    private Long sellerId;

    @Column(name = "page_id", nullable = false, length = 100)
    private String pageId;

    @Column(name = "page_name", length = 255)
    private String pageName;

    @Lob
    @Column(name = "encrypted_page_access_token", nullable = false)
    private String encryptedPageAccessToken;

    @Column(name = "token_last_updated_at", nullable = false)
    private LocalDateTime tokenLastUpdatedAt;
}
