from minio import Minio
from minio.error import S3Error
import os
from typing import Optional
import uuid


class MinioClientWrapper:
    def __init__(self):
        self.client = Minio(
            endpoint=os.getenv("MINIO_ENDPOINT", "localhost:9000"),
            access_key=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
            secret_key=os.getenv("MINIO_SECRET_KEY", "minioadmin"),
            secure=False  # For local development
        )
        self.bucket = os.getenv("MINIO_BUCKET", "hoaquason-ai")

    def ensure_bucket(self):
        """Create bucket if it doesn't exist"""
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
        except S3Error as e:
            print(f"MinIO error: {e}")

    def upload_image(self, image_bytes: bytes, content_type: str, filename: Optional[str] = None) -> str:
        """Upload image and return URL"""
        if not filename:
            filename = f"{uuid.uuid4()}.jpg"

        object_name = f"uploads/{filename}"

        try:
            self.client.put_object(
                bucket_name=self.bucket,
                object_name=object_name,
                data=image_bytes,
                length=len(image_bytes),
                content_type=content_type
            )

            # Return local URL for development
            return f"http://localhost:9000/{self.bucket}/{object_name}"

        except S3Error as e:
            raise Exception(f"Failed to upload image: {e}")