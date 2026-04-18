VISION_PROMPT = """
Analyze these fruit images and extract detailed information for pricing and marketing.

IMPORTANT: Return ONLY a valid JSON object with this exact structure. Do not include any text before or after the JSON.

{
  "product_name": "string - Vietnamese fruit name",
  "grade": "string - quality level (Loại 1, Loại 2, Loại 3)",
  "freshness": "string - freshness level (Tươi, Trung bình, Hơi úa)",
  "defects": ["array of strings - visible defects"],
  "certifications": ["array of strings - certifications like VietGAP, Organic"],
  "category": "string - product category",
  "confidence": number between 0-1
}

Do not use regex or text parsing - generate the JSON directly from your analysis.
"""

POST_GEN_PROMPT = """
Write a compelling Vietnamese Facebook marketplace post for this fruit.

Product info: {product_info}

IMPORTANT: Return ONLY a valid JSON object with this exact structure. Do not include any text before or after the JSON.

{
  "title": "string - catchy Vietnamese title",
  "description": "string - detailed Vietnamese description",
  "hashtags": ["array of strings - relevant Vietnamese hashtags"]
}

Keep natural, persuasive tone. Use Vietnamese language only.
"""