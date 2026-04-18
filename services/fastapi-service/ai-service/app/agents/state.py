from typing import TypedDict, Optional, Any, List, Tuple


class PostGenState(TypedDict):
    # Input
    images: List[Tuple[bytes, str]]  # list of (image_bytes, content_type)
    user_input: Optional[dict]       # additional user inputs like quantity, region, etc.

    # Services
    embedding_service: Any
    postgres_client: Any
    qdrant_client: Any
    minio_client: Any

    # Intermediate results
    vision_result: Optional[dict]
    base_price_result: Optional[dict]
    seasonal_result: Optional[dict]
    similar_result: Optional[dict]
    pricing_result: Optional[dict]
    post_result: Optional[dict]

    # Validation
    validation_result: Optional[dict]

    # Output
    draft_id: Optional[str]
    error: Optional[str]