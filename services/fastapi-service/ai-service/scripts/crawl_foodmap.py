#!/usr/bin/env python3
"""
Crawl product data from Foodmap.vn and Postmart.vn
"""

import requests
from bs4 import BeautifulSoup
import json
import time
from typing import List, Dict


def crawl_foodmap() -> List[Dict]:
    """Crawl products from Foodmap.vn"""
    products = []

    # Placeholder - implement actual crawling
    sample_products = [
        {
            "name": "Xoài cát Hòa Lộc loại 1",
            "price": 55000,
            "grade": "loại 1",
            "category": "trái cây"
        },
        {
            "name": "Xoài cát Chu loại 2",
            "price": 40000,
            "grade": "loại 2",
            "category": "trái cây"
        },
        # Add more products...
    ]

    products.extend(sample_products)
    return products


def crawl_postmart() -> List[Dict]:
    """Crawl products from Postmart.vn"""
    products = []

    # Placeholder - implement actual crawling
    sample_products = [
        {
            "name": "Sầu riêng Ri6 loại 1",
            "price": 120000,
            "grade": "loại 1",
            "category": "trái cây"
        },
        {
            "name": "Mít tố nữ loại 2",
            "price": 20000,
            "grade": "loại 2",
            "category": "trái cây"
        },
        # Add more products...
    ]

    products.extend(sample_products)
    return products


def main():
    print("Crawling product data...")

    foodmap_products = crawl_foodmap()
    postmart_products = crawl_postmart()

    all_products = foodmap_products + postmart_products

    # Save to JSON
    with open("crawled_products.json", "w", encoding="utf-8") as f:
        json.dump(all_products, f, ensure_ascii=False, indent=2)

    print(f"Crawled {len(all_products)} products")


if __name__ == "__main__":
    main()