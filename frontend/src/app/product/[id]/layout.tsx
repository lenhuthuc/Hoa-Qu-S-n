import { Metadata } from "next";

interface Props {
  params: { id: string };
  children: React.ReactNode;
}

async function getProduct(id: number) {
  try {
    const url = `http://localhost:8080/api/products/${id}`;
    const res = await fetch(url, {
      next: { revalidate: 60 },
      headers: {
        'Accept': 'application/json',
      }
    });
    if (!res.ok) {
      console.error(`Failed to fetch product: ${res.status}`);
      return null;
    }
    const data = await res.json();
    console.log('Product data:', data);
    return data;
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
}

function getAbsoluteImageUrl(imageUrl: string | undefined, shareUrl: string): string {
  if (!imageUrl) return "https://via.placeholder.com/600x400?text=Hoa+Qua+Son";
  
  // Nếu đã là absolute URL (có http/https)
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // Nếu là relative path, thêm base URL (ngrok domain)
  const baseUrl = shareUrl.replace(/\/$/, '');
  return `${baseUrl}${imageUrl}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(Number(params.id));

  if (!product) {
    return {
      title: "Sản phẩm không tìm thấy",
      description: "Sản phẩm này không tồn tại",
    };
  }

  // Xử lý response structure - có thể là { data: {...} } hoặc {...}
  const data = product.data || product;
  
  const productName = data.productName || data.name || "Sản phẩm";
  const price = data.price || 0;
  
  // Tạo meta description ngắn (cho SEO)
  let description = data.description?.trim() || 
                   `${data.shopName || 'Hoa Quả Sơn'} - ${data.categoryName || 'Sản phẩm chất lượng'}: ${productName}` ||
                   `${productName} - Sản phẩm chất lượng cao từ Hoa Quả Sơn`;
  description = description.substring(0, 160);
  
  // Tạo description dài cho Facebook preview - sẽ hiển thị dưới link preview
  const productDesc = data.description?.trim() || `${data.categoryName || 'Sản phẩm chất lượng cao'} từ Hoa Quả Sơn`;
  const ogDescription = `${data.shopName || 'Hoa Quả Sơn'}\n\n${productName}\n📦 ${data.categoryName || 'Trái cây'}\n\n${productDesc}\n\n💰 Giá: ${price.toLocaleString('vi-VN')}đ\n🏪 Nông sản Việt Nam chất lượng cao\n\n#hoaquason #nongsan #traicay #fresh #vietnam`;
  
  // Lấy image URL - ưu tiên imageUrls[0] vì nó có kích thước đủ cho Facebook (200x200px+)
  let imageUrl = data.imageUrls?.[0] || data.imageUrl;
  
  const shareUrl = process.env.NEXT_PUBLIC_SHARE_URL || 'http://localhost:3000';
  imageUrl = getAbsoluteImageUrl(imageUrl, shareUrl);
  
  const finalUrl = `${shareUrl}/product/${params.id}`;

  return {
    title: `${productName} - ${price.toLocaleString("vi-VN")}đ | Hoa Quả Sơn`,
    description: description,
    openGraph: {
      type: "website",
      title: `${productName} - ${price.toLocaleString("vi-VN")}đ`,
      description: ogDescription,  // Tối ưu cho Facebook preview
      images: [
        {
          url: imageUrl,
          width: 600,
          height: 400,
          alt: productName,
        }
      ],
      url: finalUrl,
      siteName: "Hoa Quả Sơn",
    },
    twitter: {
      card: "summary_large_image",
      title: `${productName} - ${price.toLocaleString("vi-VN")}đ`,
      description: description,
      images: [imageUrl],
    },
  };
}

export default function ProductLayout({ children }: Props) {
  return children;
}
