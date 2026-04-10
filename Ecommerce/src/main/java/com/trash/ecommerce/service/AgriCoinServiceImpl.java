package com.trash.ecommerce.service;

import com.trash.ecommerce.entity.AgriCoin;
import com.trash.ecommerce.entity.CoinTransaction;
import com.trash.ecommerce.entity.Users;
import com.trash.ecommerce.repository.AgriCoinRepository;
import com.trash.ecommerce.repository.CoinTransactionRepository;
import com.trash.ecommerce.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgriCoinServiceImpl implements AgriCoinService {

    @Autowired
    private AgriCoinRepository agriCoinRepository;
    @Autowired
    private CoinTransactionRepository coinTransactionRepository;
    @Autowired
    private UserRepository userRepository;

    private AgriCoin getOrCreate(Long userId) {
        return agriCoinRepository.findByUserId(userId).orElseGet(() -> {
            Users user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
            AgriCoin coin = new AgriCoin();
            coin.setUser(user);
            coin.setBalance(0);
            coin.setTotalEarned(0);
            coin.setTotalSpent(0);
            return agriCoinRepository.save(coin);
        });
    }

    @Override
    @Transactional
    public void reward(Long userId, int amount, String type, String description, Long referenceId) {
        if (amount <= 0) throw new IllegalArgumentException("Amount must be positive");
        AgriCoin coin = getOrCreate(userId);
        coin.setBalance(coin.getBalance() + amount);
        coin.setTotalEarned(coin.getTotalEarned() + amount);
        agriCoinRepository.save(coin);

        Users user = userRepository.findById(userId).orElseThrow();
        CoinTransaction tx = new CoinTransaction();
        tx.setUser(user);
        tx.setAmount(amount);
        tx.setType(type);
        tx.setDescription(description);
        tx.setReferenceId(referenceId);
        coinTransactionRepository.save(tx);
    }

    @Override
    @Transactional
    public void spend(Long userId, int amount, String description, Long referenceId) {
        if (amount <= 0) throw new IllegalArgumentException("Amount must be positive");
        AgriCoin coin = getOrCreate(userId);
        if (coin.getBalance() < amount) throw new RuntimeException("Không đủ AgriCoin");
        coin.setBalance(coin.getBalance() - amount);
        coin.setTotalSpent(coin.getTotalSpent() + amount);
        agriCoinRepository.save(coin);

        Users user = userRepository.findById(userId).orElseThrow();
        CoinTransaction tx = new CoinTransaction();
        tx.setUser(user);
        tx.setAmount(-amount);
        tx.setType("VOUCHER_REDEEM");
        tx.setDescription(description);
        tx.setReferenceId(referenceId);
        coinTransactionRepository.save(tx);
    }

    @Override
    public int getBalance(Long userId) {
        return getOrCreate(userId).getBalance();
    }
}
