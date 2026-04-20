package com.trash.ecommerce.repository;

import com.trash.ecommerce.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    @Query("SELECT c FROM Conversation c WHERE (c.buyer.id = :userId AND c.deletedByBuyer = false) OR (c.seller.id = :userId AND c.deletedBySeller = false) ORDER BY c.lastMessageAt DESC")
    List<Conversation> findByUserId(Long userId);

    @Query("SELECT c FROM Conversation c WHERE (c.buyer.id = :buyerId AND c.seller.id = :sellerId) OR (c.buyer.id = :sellerId AND c.seller.id = :buyerId)")
    Optional<Conversation> findByBuyerIdAndSellerId(Long buyerId, Long sellerId);

    @Modifying
    @Transactional
    @Query("UPDATE Conversation c SET c.buyerUnread = 0 WHERE c.id = :conversationId")
    void resetBuyerUnread(Long conversationId);

    @Modifying
    @Transactional
    @Query("UPDATE Conversation c SET c.sellerUnread = 0 WHERE c.id = :conversationId")
    void resetSellerUnread(Long conversationId);
}
