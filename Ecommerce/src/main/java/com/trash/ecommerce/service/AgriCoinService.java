package com.trash.ecommerce.service;

public interface AgriCoinService {
    void reward(Long userId, int amount, String type, String description, Long referenceId);
    void spend(Long userId, int amount, String description, Long referenceId);
    int getBalance(Long userId);
}
