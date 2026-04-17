package com.trash.ecommerce.controller;

import com.trash.ecommerce.entity.Conversation;
import com.trash.ecommerce.entity.Message;
import com.trash.ecommerce.entity.Users;
import com.trash.ecommerce.repository.ConversationRepository;
import com.trash.ecommerce.repository.MessageRepository;
import com.trash.ecommerce.repository.UserRepository;
import com.trash.ecommerce.service.JwtService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    @Autowired
    private ConversationRepository conversationRepository;
    @Autowired
    private MessageRepository messageRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private JwtService jwtService;

    @GetMapping("/conversations")
    public ResponseEntity<?> getConversations(@RequestHeader("Authorization") String token) {
        try {
            Long userId = jwtService.extractId(token);
            List<Conversation> conversations = conversationRepository.findByUserId(userId);
            List<Map<String, Object>> result = conversations.stream().map(c -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("id", c.getId());
                Users other = c.getBuyer().getId().equals(userId) ? c.getSeller() : c.getBuyer();
                map.put("otherUserId", other.getId());
                map.put("otherUserName", other.getFullName() != null ? other.getFullName() : other.getUsername());
                map.put("lastMessage", c.getLastMessage());
                map.put("lastMessageAt", c.getLastMessageAt());
                int unread = c.getBuyer().getId().equals(userId) ? c.getBuyerUnread() : c.getSellerUnread();
                map.put("unreadCount", unread);
                return map;
            }).toList();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/conversations/{otherUserId}")
    public ResponseEntity<?> getOrCreateConversation(
            @RequestHeader("Authorization") String token,
            @PathVariable Long otherUserId) {
        try {
            Long userId = jwtService.extractId(token);
            Conversation conv = conversationRepository.findByBuyerIdAndSellerId(userId, otherUserId)
                    .orElseGet(() -> {
                        Users buyer = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
                        Users seller = userRepository.findById(otherUserId).orElseThrow(() -> new RuntimeException("User not found"));
                        Conversation c = new Conversation();
                        c.setBuyer(buyer);
                        c.setSeller(seller);
                        return conversationRepository.save(c);
                    });
            return ResponseEntity.ok(Map.of("conversationId", conv.getId()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<?> getMessages(
            @RequestHeader("Authorization") String token,
            @PathVariable Long conversationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        try {
            Long userId = jwtService.extractId(token);
            Conversation conv = conversationRepository.findById(conversationId)
                    .orElseThrow(() -> new RuntimeException("Conversation not found"));
            if (!conv.getBuyer().getId().equals(userId) && !conv.getSeller().getId().equals(userId)) {
                return ResponseEntity.status(403).body(Map.of("message", "Access denied"));
            }

            messageRepository.markAsRead(conversationId, userId);
            if (conv.getBuyer().getId().equals(userId)) {
                conversationRepository.resetBuyerUnread(conversationId);
            } else {
                conversationRepository.resetSellerUnread(conversationId);
            }

            Page<Message> messages = messageRepository.findByConversationIdOrderByCreatedAtDesc(
                    conversationId, PageRequest.of(page, size));
            List<Map<String, Object>> result = messages.getContent().stream().map(m -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("id", m.getId());
                map.put("senderId", m.getSender().getId());
                map.put("senderName", m.getSender().getFullName() != null ? m.getSender().getFullName() : m.getSender().getUsername());
                map.put("content", m.getContent());
                map.put("isRead", m.getIsRead());
                map.put("createdAt", m.getCreatedAt());
                return map;
            }).toList();
            return ResponseEntity.ok(Map.of("messages", result, "totalPages", messages.getTotalPages()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<?> sendMessage(
            @RequestHeader("Authorization") String token,
            @PathVariable Long conversationId,
            @RequestBody Map<String, String> body) {
        try {
            Long userId = jwtService.extractId(token);
            String content = body.get("content");
            if (content == null || content.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Content is required"));
            }

            Conversation conv = conversationRepository.findById(conversationId)
                    .orElseThrow(() -> new RuntimeException("Conversation not found"));
            if (!conv.getBuyer().getId().equals(userId) && !conv.getSeller().getId().equals(userId)) {
                return ResponseEntity.status(403).body(Map.of("message", "Access denied"));
            }

            Users sender = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
            Message msg = new Message();
            msg.setConversation(conv);
            msg.setSender(sender);
            msg.setContent(content);
            messageRepository.save(msg);

            conv.setLastMessage(content.length() > 500 ? content.substring(0, 500) : content);
            conv.setLastMessageAt(LocalDateTime.now());
            if (conv.getBuyer().getId().equals(userId)) {
                conv.setSellerUnread(conv.getSellerUnread() + 1);
                // Nếu seller đã xóa, nhắn tin mới sẽ khôi phục conversation cho họ
                conv.setDeletedBySeller(false);
            } else {
                conv.setBuyerUnread(conv.getBuyerUnread() + 1);
                // Nếu buyer đã xóa, nhắn tin mới sẽ khôi phục conversation cho họ
                conv.setDeletedByBuyer(false);
            }
            conversationRepository.save(conv);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", msg.getId());
            result.put("senderId", sender.getId());
            result.put("senderName", sender.getFullName() != null ? sender.getFullName() : sender.getUsername());
            result.put("content", msg.getContent());
            result.put("createdAt", msg.getCreatedAt());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/conversations/{conversationId}")
    public ResponseEntity<?> deleteConversation(
            @RequestHeader("Authorization") String token,
            @PathVariable Long conversationId) {
        try {
            Long userId = jwtService.extractId(token);
            Conversation conv = conversationRepository.findById(conversationId)
                    .orElseThrow(() -> new RuntimeException("Conversation not found"));

            if (!conv.getBuyer().getId().equals(userId) && !conv.getSeller().getId().equals(userId)) {
                return ResponseEntity.status(403).body(Map.of("message", "Access denied"));
            }

            if (conv.getBuyer().getId().equals(userId)) {
                conv.setDeletedByBuyer(true);
            } else {
                conv.setDeletedBySeller(true);
            }

            // Hard delete khi cả 2 đều đã xóa
            if (Boolean.TRUE.equals(conv.getDeletedByBuyer()) && Boolean.TRUE.equals(conv.getDeletedBySeller())) {
                conversationRepository.delete(conv);
            } else {
                conversationRepository.save(conv);
            }

            return ResponseEntity.ok(Map.of("message", "Conversation deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
