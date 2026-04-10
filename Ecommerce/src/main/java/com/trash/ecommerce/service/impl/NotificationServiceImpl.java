package com.trash.ecommerce.service.impl;

import com.trash.ecommerce.dto.NotificationDTO;
import com.trash.ecommerce.entity.Notification;
import com.trash.ecommerce.entity.NotificationType;
import com.trash.ecommerce.entity.Users;
import com.trash.ecommerce.repository.NotificationRepository;
import com.trash.ecommerce.repository.UserRepository;
import com.trash.ecommerce.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationServiceImpl implements NotificationService {

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @Override
    @Transactional
    public void send(Long userId, String title, String message, NotificationType type, Long referenceId) {
        Users user = userRepository.findById(userId).orElse(null);
        if (user == null) return;

        Notification notification = new Notification();
        notification.setUser(user);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setType(type);
        notification.setReferenceId(referenceId);
        notificationRepository.save(notification);
    }

    @Override
    public Page<NotificationDTO> getNotifications(Long userId, int page, int size) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(page, size))
                .map(this::toDTO);
    }

    @Override
    public long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Override
    @Transactional
    public void markAsRead(Long notificationId, Long userId) {
        notificationRepository.markAsRead(notificationId, userId);
    }

    @Override
    @Transactional
    public void markAllAsRead(Long userId) {
        notificationRepository.markAllAsRead(userId);
    }

    private NotificationDTO toDTO(Notification n) {
        NotificationDTO dto = new NotificationDTO();
        dto.setId(n.getId());
        dto.setTitle(n.getTitle());
        dto.setMessage(n.getMessage());
        dto.setType(n.getType());
        dto.setReferenceId(n.getReferenceId());
        dto.setIsRead(n.getIsRead());
        dto.setCreatedAt(n.getCreatedAt());
        return dto;
    }
}
