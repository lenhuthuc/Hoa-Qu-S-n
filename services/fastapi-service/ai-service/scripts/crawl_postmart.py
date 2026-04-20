#!/usr/bin/env python3
"""
Crawl product data from Postmart.vn
"""

# This is essentially the same as crawl_foodmap.py for now
# In real implementation, adapt to Postmart's API/website structure

from scripts.crawl_foodmap import crawl_postmart

if __name__ == "__main__":
    crawl_postmart()