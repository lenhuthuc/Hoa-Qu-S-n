from typing import Dict, Any
from app.agents.state import PostGenState


async def validate_input(state: PostGenState) -> Dict[str, Any]:
    """Validate input images and user data"""
    images = state.get("images", [])
    if not images:
        return {"error": "Cần ít nhất 1 ảnh"}

    if len(images) > 5:
        return {"images": images[:5]}

    # Validate image sizes
    for img_bytes, content_type in images:
        if len(img_bytes) > 20 * 1024 * 1024:  # 20MB
            return {"error": "Ảnh quá lớn (tối đa 20MB)"}

        if content_type not in ["image/jpeg", "image/png", "image/webp"]:
            return {"error": "Chỉ chấp nhận ảnh JPEG, PNG, WEBP"}

    return {"validation_result": {"passed": True, "stage": "input"}}


async def post_validator(state: PostGenState) -> Dict[str, Any]:
    """Validate generated post content"""
    post = state.get("post_result", {})

    if not post.get("title"):
        return {"error": "Thiếu title trong bài đăng"}

    if not post.get("description"):
        return {"error": "Thiếu description trong bài đăng"}

    if len(post.get("description", "")) < 50:
        return {"error": "Description quá ngắn"}

    return {"validation_result": {"passed": True, "stage": "post"}}