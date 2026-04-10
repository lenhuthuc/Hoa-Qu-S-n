package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.NotificationDTO;
import com.trash.ecommerce.entity.NotificationType;
import org.springframework.data.domain.Page;

public interface NotificationService {
    void send(Long userId, String title, String message, NotificationType type, Long referenceId);
    Page<NotificationDTO> getNotifications(Long userId, int page, int size);
    long getUnreadCount(Long userId);
    void markAsRead(Long notificationId, Long userId);
    void markAllAsRead(Long userId);
}
