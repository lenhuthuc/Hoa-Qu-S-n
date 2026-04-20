from pydantic import BaseModel, Field
from typing import List, Optional


class VisionResult(BaseModel):
    product_name: str = Field(..., description="Tên sản phẩm tiếng Việt, càng cụ thể càng tốt")
    features: List[str] = Field(
        ...,
        description="Đúng 15 đặc trưng nổi bật nhất theo thứ tự quan trọng. "
                    "features[0] BẮT BUỘC là tên sản phẩm (giống product_name). "
                    "Ví dụ: ['Xoài cát Hòa Lộc', 'màu vàng chín đều', 'kích thước lớn 300-400g', ...]",
    )
    grade: str = Field(..., description="Cấp độ chất lượng (Loại 1, Loại 2, Loại 3)")
    freshness: str = Field(..., description="Mức độ tươi (Rất tươi, Tươi, Bình thường, Kém tươi)")
    defects: List[str] = Field(default_factory=list, description="Danh sách khuyết tật nhìn thấy")
    certifications: List[str] = Field(default_factory=list, description="Chứng nhận (VietGAP, Organic, etc.)")
    category: str = Field(..., description="Danh mục sản phẩm")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Độ tin cậy của phân tích")
    provider: Optional[str] = Field(None, description="Provider đã sử dụng")


class PricingResult(BaseModel):
    suggested_price_per_kg: int = Field(..., gt=0, description="Giá đề xuất VND/kg")
    breakdown: List[str] = Field(..., description="Phân tích giá theo bước")

    class MarketInfo(BaseModel):
        similar_products: List[dict] = Field(..., description="Sản phẩm tương tự")
        market_avg: int = Field(..., gt=0, description="Giá trung bình thị trường")
        note: str = Field(..., description="Ghi chú về thị trường")

    market: MarketInfo


class PostResult(BaseModel):
    title: str = Field(..., description="Tiêu đề bài đăng")
    description: str = Field(..., description="Nội dung mô tả")
    hashtags: List[str] = Field(default_factory=list, description="Hashtags")


class GeneratePostResponse(BaseModel):
    success: bool
    draft_id: Optional[str] = None
    data: Optional[dict] = None  # Contains vision, pricing, post data
    error: Optional[str] = None