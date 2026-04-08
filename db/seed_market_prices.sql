-- ══════════════════════════════════════════════════════
-- MySQL seed data for market_prices table (Spring/MySQL)
-- Run against MySQL ONLY — NOT PostgreSQL.
-- JPA will auto-create the table from the MarketPrice entity.
-- ══════════════════════════════════════════════════════

INSERT INTO market_prices (product_name, category, region, avg_price, min_price, max_price, unit, source) VALUES
('Xoài cát Hòa Lộc', 'Trái cây', 'Tiền Giang', 45000, 35000, 55000, 'kg', 'Sở NN&PTNT'),
('Vải thiều Bắc Giang', 'Trái cây', 'Bắc Giang', 35000, 25000, 50000, 'kg', 'Sở NN&PTNT'),
('Sầu riêng Ri6', 'Trái cây', 'Bến Tre', 85000, 70000, 120000, 'kg', 'Chợ đầu mối'),
('Thanh long ruột đỏ', 'Trái cây', 'Bình Thuận', 25000, 15000, 35000, 'kg', 'Sở NN&PTNT'),
('Bưởi da xanh', 'Trái cây', 'Bến Tre', 40000, 30000, 55000, 'kg', 'HTX'),
('Cam sành', 'Trái cây', 'Vĩnh Long', 20000, 12000, 30000, 'kg', 'Chợ đầu mối'),
('Măng cụt', 'Trái cây', 'Bình Dương', 50000, 35000, 70000, 'kg', 'Sở NN&PTNT'),
('Nhãn lồng Hưng Yên', 'Trái cây', 'Hưng Yên', 55000, 40000, 75000, 'kg', 'HTX'),
('Chôm chôm', 'Trái cây', 'Đồng Nai', 18000, 12000, 25000, 'kg', 'Chợ đầu mối'),
('Mít Thái', 'Trái cây', 'Tiền Giang', 15000, 8000, 25000, 'kg', 'Chợ đầu mối'),
('Ổi Đài Loan', 'Trái cây', 'Long An', 15000, 10000, 22000, 'kg', 'HTX'),
('Dưa hấu', 'Trái cây', 'Quảng Ngãi', 8000, 4000, 15000, 'kg', 'Chợ đầu mối'),
('Chuối già Nam Mỹ', 'Trái cây', 'Đồng Nai', 12000, 8000, 18000, 'kg', 'HTX'),
('Dừa xiêm', 'Trái cây', 'Bến Tre', 10000, 7000, 15000, 'quả', 'HTX'),
('Sapoche', 'Trái cây', 'Tiền Giang', 22000, 15000, 30000, 'kg', 'Chợ đầu mối'),
('Bơ 034', 'Trái cây', 'Đắk Lắk', 45000, 30000, 65000, 'kg', 'Sở NN&PTNT'),
('Quýt đường', 'Trái cây', 'Lai Vung', 25000, 18000, 35000, 'kg', 'HTX'),
('Mận Sơn La', 'Trái cây', 'Sơn La', 30000, 20000, 45000, 'kg', 'Chợ đầu mối'),
('Đào Sa Pa', 'Trái cây', 'Lào Cai', 60000, 45000, 80000, 'kg', 'Sở NN&PTNT'),
('Lê Tai-nung', 'Trái cây', 'Lâm Đồng', 35000, 25000, 50000, 'kg', 'HTX');
