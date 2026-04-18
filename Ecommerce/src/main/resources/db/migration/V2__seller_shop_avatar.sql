ALTER TABLE seller_applications
ADD COLUMN IF NOT EXISTS shop_avatar VARCHAR(1000);

UPDATE seller_applications sa
SET shop_avatar = u.avatar
FROM users u
WHERE sa.user_id = u.id
  AND sa.shop_avatar IS NULL
  AND u.avatar IS NOT NULL;