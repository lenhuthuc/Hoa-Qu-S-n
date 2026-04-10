package com.trash.ecommerce.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Publishes events to Redis channels so the Node.js gateway
 * can push real-time updates to connected WebSocket clients.
 */
@Service
public class EventPublisher {

    private static final Logger log = LoggerFactory.getLogger(EventPublisher.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    /**
     * Publish order status update → gateway /orders namespace pushes to user.
     */
    public void publishOrderUpdate(Long userId, Long orderId, String status, String message) {
        try {
            Map<String, Object> payload = Map.of(
                "userId", userId,
                "orderId", orderId,
                "status", status,
                "message", message,
                "timestamp", System.currentTimeMillis()
            );
            redisTemplate.convertAndSend("order:update", objectMapper.writeValueAsString(payload));
        } catch (Exception e) {
            log.error("Failed to publish order update", e);
        }
    }

    /**
     * Publish notification → gateway can optionally push real-time notification events.
     */
    public void publishNotification(Long userId, String title, String type, Long referenceId) {
        try {
            Map<String, Object> payload = Map.of(
                "userId", userId,
                "title", title,
                "type", type,
                "referenceId", referenceId != null ? referenceId : 0,
                "timestamp", System.currentTimeMillis()
            );
            redisTemplate.convertAndSend("notification:push", objectMapper.writeValueAsString(payload));
        } catch (Exception e) {
            log.error("Failed to publish notification", e);
        }
    }
}
