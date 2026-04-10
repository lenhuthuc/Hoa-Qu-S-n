package com.trash.ecommerce.dto;

import com.trash.ecommerce.entity.NotificationType;
import lombok.*;

import java.util.Date;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class NotificationDTO {
    private Long id;
    private String title;
    private String message;
    private NotificationType type;
    private Long referenceId;
    private Boolean isRead;
    private Date createdAt;
}
