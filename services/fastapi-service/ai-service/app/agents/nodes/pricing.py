import yaml
import os
from datetime import datetime
from typing import Dict, Any, List
from app.agents.state import PostGenState


async def base_price(state: PostGenState) -> Dict[str, Any]:
    """Get base price from knowledge base"""
    vision = state["vision_result"]
    product_name = vision.get("product_name", "").lower()
    grade = vision.get("grade", "Loại 2").lower()

    # Load pricing KB
    kb_path = os.path.join(os.path.dirname(__file__), "../../data/pricing_kb.yaml")
    with open(kb_path, "r", encoding="utf-8") as f:
        kb = yaml.safe_load(f)

    # Find matching product
    base_price = None
    for prod, grades in kb.items():
        if prod.lower() in product_name:
            base_price = grades.get(grade, grades.get("loại 2", 30000))
            break

    if not base_price:
        base_price = 30000  # Default fallback

    return {
        "base_price_result": {
            "product_name": product_name,
            "grade": grade,
            "base_price_per_kg": base_price
        }
    }


async def seasonal(state: PostGenState) -> Dict[str, Any]:
    """Apply seasonal multiplier"""
    base_result = state["base_price_result"]
    base_price = base_result["base_price_per_kg"]

    # Load seasonal info
    seasonal_path = os.path.join(os.path.dirname(__file__), "../../data/seasonal_info.yaml")
    with open(seasonal_path, "r", encoding="utf-8") as f:
        seasonal_data = yaml.safe_load(f)

    current_month = datetime.now().strftime("%B").lower()
    product_name = base_result["product_name"]

    # Find seasonal multiplier
    multiplier = 1.0
    for fruit_type, months in seasonal_data.items():
        if fruit_type in product_name:
            multiplier = months.get(current_month, 1.0)
            break

    seasonal_price = int(base_price * multiplier)

    return {
        "seasonal_result": {
            "base_price": base_price,
            "seasonal_multiplier": multiplier,
            "seasonal_price": seasonal_price,
            "month": current_month
        }
    }


async def similar(state: PostGenState) -> Dict[str, Any]:
    """Find similar products using kNN"""
    vision = state["vision_result"]
    qdrant_client = state["qdrant_client"]

    # Create query vector (placeholder - in real implementation, use embedding)
    # For now, return mock similar products
    similar_products = [
        {"product_name": "xoài cát Hòa Lộc loại 2", "price": 42000, "score": 0.95},
        {"product_name": "xoài cát Chu loại 2", "price": 38000, "score": 0.89},
        {"product_name": "xoài keo loại 2", "price": 36000, "score": 0.85},
        {"product_name": "xoài tượng loại 2", "price": 34000, "score": 0.82},
        {"product_name": "xoài cát Hòa Lộc loại 1", "price": 52000, "score": 0.78},
        {"product_name": "xoài cát Hòa Lộc loại 3", "price": 32000, "score": 0.75},
        {"product_name": "sầu riêng Ri6 loại 2", "price": 95000, "score": 0.45},
        {"product_name": "mít tố nữ loại 2", "price": 19000, "score": 0.42}
    ]

    # Calculate market average from similar products
    prices = [p["price"] for p in similar_products[:5]]  # Top 5
    market_avg = sum(prices) / len(prices) if prices else 35000

    return {
        "similar_result": {
            "similar_products": similar_products[:8],
            "market_avg": int(market_avg),
            "knn_count": len(similar_products)
        }
    }


async def price_calculator(state: PostGenState) -> Dict[str, Any]:
    """Calculate final price with all multipliers"""
    vision = state["vision_result"]
    seasonal_result = state["seasonal_result"]
    similar_result = state["similar_result"]

    base_price = seasonal_result["seasonal_price"]
    market_avg = similar_result["market_avg"]

    # Apply defect multipliers
    defect_multiplier = 1.0
    defects = vision.get("defects", [])
    if defects:
        if any("dập" in d.lower() for d in defects):
            defect_multiplier *= 0.85
        if any("thối" in d.lower() or "sâu" in d.lower() for d in defects):
            defect_multiplier *= 0.7

    # Apply certification bonus
    cert_multiplier = 1.0
    certifications = vision.get("certifications", [])
    if "VietGAP" in certifications:
        cert_multiplier *= 1.10
    if "Organic" in certifications:
        cert_multiplier *= 1.15

    # Calculate final price
    final_price = int(base_price * defect_multiplier * cert_multiplier)

    # Blend with market average (kNN)
    blended_price = int((final_price * 0.7) + (market_avg * 0.3))

    # Build breakdown
    breakdown = [
        f"Giá gốc {vision.get('grade', 'Loại 2')}: {seasonal_result['base_price']:,} VND",
        f"× {seasonal_result['seasonal_multiplier']:.2f} (mùa {seasonal_result['month']})",
    ]

    if defect_multiplier < 1.0:
        breakdown.append(f"× {defect_multiplier:.2f} (có khuyết tật)")

    if cert_multiplier > 1.0:
        breakdown.append(f"× {cert_multiplier:.2f} (chứng nhận)")

    breakdown.append(f"= {blended_price:,} VND/kg")

    return {
        "pricing_result": {
            "suggested_price_per_kg": blended_price,
            "breakdown": breakdown,
            "market": {
                "similar_products": similar_result["similar_products"],
                "market_avg": market_avg,
                "note": f"{len(similar_result['similar_products'])} sản phẩm tương tự, giá TB {market_avg:,} VND"
            }
        }
    }