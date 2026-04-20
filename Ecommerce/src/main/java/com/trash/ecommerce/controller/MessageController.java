package com.trash.ecommerce.controller;

import com.trash.ecommerce.entity.Conversation;
import com.trash.ecommerce.entity.Message;
import com.trash.ecommerce.entity.SellerApplication;
import com.trash.ecommerce.entity.Users;
import com.trash.ecommerce.repository.ConversationRepository;
import com.trash.ecommerce.repository.MessageRepository;
import com.trash.ecommerce.repository.SellerApplicationRepository;
import com.trash.ecommerce.repository.UserRepository;
import com.trash.ecommerce.service.JwtService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
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
    private SellerApplicationRepository sellerApplicationRepository;
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
                Users me = c.getBuyer().getId().equals(userId) ? c.getBuyer() : c.getSeller();
                map.put("otherUserId", other.getId());
                map.put("otherUserName", resolveDisplayName(other));
                map.put("otherUserAvatar", resolveChatAvatarForParticipant(c, other));
                map.put("myAvatar", resolveChatAvatarForParticipant(c, me));
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
            Users currentUser = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
            Users otherUser = userRepository.findById(otherUserId).orElseThrow(() -> new RuntimeException("User not found"));

            Conversation conv = conversationRepository.findByBuyerIdAndSellerId(userId, otherUserId)
                    .orElseGet(() -> {
                Conversation fresh = new Conversation();
                fresh.setBuyer(currentUser);
                fresh.setSeller(otherUser);
                return conversationRepository.save(fresh);
            });

            return ResponseEntity.ok(Map.of(
                    "conversationId", conv.getId(),
                    "otherUserName", resolveDisplayName(otherUser),
                    "otherUserAvatar", resolveChatAvatarForParticipant(conv, otherUser)));
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

                LocalDateTime deletedAt = conv.getBuyer().getId().equals(userId)
                    ? conv.getDeletedAtBuyer()
                    : conv.getDeletedAtSeller();

                Page<Message> messages = (deletedAt != null)
                    ? messageRepository.findByConversationIdAndCreatedAtAfterOrderByCreatedAtDesc(
                        conversationId, deletedAt, PageRequest.of(page, size))
                    : messageRepository.findByConversationIdOrderByCreatedAtDesc(
                        conversationId, PageRequest.of(page, size));
            List<Map<String, Object>> result = messages.getContent().stream().map(m -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("id", m.getId());
                map.put("senderId", m.getSender().getId());
                map.put("senderName", resolveDisplayName(m.getSender()));
                map.put("senderAvatar", resolveChatAvatarForParticipant(conv, m.getSender()));
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
                // Người gửi vừa hoạt động lại, conversation nên hiện trở lại trong danh sách của họ
                conv.setDeletedByBuyer(false);
                // Nếu seller đã xóa, nhắn tin mới sẽ khôi phục conversation cho họ trong danh sách
                conv.setDeletedBySeller(false);
            } else {
                conv.setBuyerUnread(conv.getBuyerUnread() + 1);
                // Người gửi vừa hoạt động lại, conversation nên hiện trở lại trong danh sách của họ
                conv.setDeletedBySeller(false);
                // Nếu buyer đã xóa, nhắn tin mới sẽ khôi phục conversation cho họ trong danh sách
                conv.setDeletedByBuyer(false);
            }
            conversationRepository.save(conv);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", msg.getId());
            result.put("senderId", sender.getId());
            result.put("senderName", resolveDisplayName(sender));
            result.put("senderAvatar", resolveChatAvatarForParticipant(conv, sender));
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
                conv.setDeletedAtBuyer(LocalDateTime.now());
            } else {
                conv.setDeletedBySeller(true);
                conv.setDeletedAtSeller(LocalDateTime.now());
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

    private String resolveDisplayName(Users user) {
        if (user == null) {
            return "Người dùng";
        }

        if (user.getId() != null) {
            SellerApplication sellerApplication = sellerApplicationRepository.findByUserId(user.getId()).orElse(null);
            if (sellerApplication != null && sellerApplication.getShopName() != null && !sellerApplication.getShopName().isBlank()) {
                return sellerApplication.getShopName().trim();
            }
        }

        if (user.getFullName() != null && !user.getFullName().isBlank()) {
            return user.getFullName().trim();
        }

        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return user.getUsername().trim();
        }

        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            return user.getEmail().trim();
        }

        return "Người dùng";
    }

    private String resolveChatAvatarForParticipant(Conversation conversation, Users participant) {
        if (participant == null) {
            return null;
        }

        boolean isSellerInConversation =
                conversation != null &&
                conversation.getSeller() != null &&
                conversation.getSeller().getId() != null &&
                conversation.getSeller().getId().equals(participant.getId());

        String rawAvatar;
        if (isSellerInConversation) {
            SellerApplication sellerApplication = sellerApplicationRepository.findByUserId(participant.getId()).orElse(null);
            rawAvatar = sellerApplication != null && sellerApplication.getShopAvatar() != null && !sellerApplication.getShopAvatar().isBlank()
                    ? sellerApplication.getShopAvatar().trim()
                    : participant.getAvatar();
        } else {
            rawAvatar = participant.getAvatar();
        }

        return resolveMediaUrlForClient(rawAvatar);
    }

    private String resolveMediaUrlForClient(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return null;
        }

        String value = rawUrl.trim();
        if (value.startsWith("/api/reviews/media")) {
            return value;
        }
        if (value.contains(".r2.cloudflarestorage.com/")) {
            return "/api/reviews/media?url=" + URLEncoder.encode(value, StandardCharsets.UTF_8);
        }
        if (value.startsWith("http://") || value.startsWith("https://")) {
            return value;
        }
        if (value.startsWith("local:")) {
            return "/api/reviews/media?url=" + URLEncoder.encode(value, StandardCharsets.UTF_8);
        }
        if (value.startsWith("review-media/") || value.startsWith("reviews/")) {
            return "/api/reviews/media?url=" + URLEncoder.encode("local:" + value, StandardCharsets.UTF_8);
        }
        return value;
    }
}
