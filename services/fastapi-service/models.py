from pydantic import BaseModel, Field
from typing import List, Optional


class VisionResult(BaseModel):
    product_name: str = ""
    features: List[str] = Field(default_factory=list)
    grade: str = ""
    category: str = ""
    freshness: str = ""
    defects: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    description: str = ""
    title: str = ""
    confidence: float = 0.0
    provider: Optional[str] = None
    error: Optional[str] = None


class PriceMultiplier(BaseModel):
    label: str
    multiplier: float


class PriceBreakdown(BaseModel):
    base_price: int
    grade: PriceMultiplier
    defect: PriceMultiplier
    certification: PriceMultiplier
    seasonal: PriceMultiplier
    freshness: PriceMultiplier


class SimilarProduct(BaseModel):
    product_name: str
    price: int
    score: float


class MarketInfo(BaseModel):
    similar_products: List[SimilarProduct] = Field(default_factory=list)
    market_avg: Optional[int] = None
    note: str = ""


class PricingResult(BaseModel):
    suggested_price_per_kg: int
    breakdown: PriceBreakdown
    market: MarketInfo


class PostResult(BaseModel):
    title: str
    description: str
    hashtags: List[str] = Field(default_factory=list)


class SmartPricingResult(BaseModel):
    suggested_price_per_kg: int = 0
    price_reasoning: str = ""


class PostData(BaseModel):
    product_name: str
    grade: str
    category: str
    freshness: str
    defects: List[str]
    certifications: List[str]
    confidence: float
    provider: Optional[str]
    title: str
    description: str
    hashtags: List[str]
    suggested_price_per_kg: int
    price_breakdown: PriceBreakdown
    similar_products: List[SimilarProduct]
    market_avg: Optional[int]
    price_reasoning: str


class GeneratePostResponse(BaseModel):
    success: bool
    draft_id: Optional[str] = None
    data: Optional[PostData] = None
    error: Optional[str] = None
