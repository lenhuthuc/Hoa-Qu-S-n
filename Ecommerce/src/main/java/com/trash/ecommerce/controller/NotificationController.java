package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.NotificationDTO;
import com.trash.ecommerce.service.JwtService;
import com.trash.ecommerce.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private JwtService jwtService;

    @GetMapping
    public ResponseEntity<?> getNotifications(
            @RequestHeader("Authorization") String token,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Long userId = jwtService.extractId(token);
            Page<NotificationDTO> notifications = notificationService.getNotifications(userId, page, size);
            return ResponseEntity.ok(notifications);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> getUnreadCount(@RequestHeader("Authorization") String token) {
        try {
            Long userId = jwtService.extractId(token);
            long count = notificationService.getUnreadCount(userId);
            return ResponseEntity.ok(Map.of("count", count));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(
            @RequestHeader("Authorization") String token,
            @PathVariable Long id) {
        try {
            Long userId = jwtService.extractId(token);
            notificationService.markAsRead(id, userId);
            return ResponseEntity.ok(Map.of("message", "Đã đánh dấu đã đọc"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/read-all")
    public ResponseEntity<?> markAllAsRead(@RequestHeader("Authorization") String token) {
        try {
            Long userId = jwtService.extractId(token);
            notificationService.markAllAsRead(userId);
            return ResponseEntity.ok(Map.of("message", "Đã đánh dấu tất cả đã đọc"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
