/**
 * Share Dialog helper - sử dụng Facebook SDK để share sản phẩm
 * 
 * Lưu ý: Facebook chỉ có thể crawl OG tags từ:
 * - Production domain (ngrok, vercel, etc.)
 * - KHÔNG thể từ localhost
 */

export interface ShareOptions {
  productId: number;
  productName: string;
  productImage?: string;
  price?: number;
}

function getShareUrl(productId: number): string {
  if (typeof window === 'undefined') return '';
  
  // Nếu có NEXT_PUBLIC_SHARE_URL env var (từ ngrok/production)
  const baseUrl = process.env.NEXT_PUBLIC_SHARE_URL || window.location.origin;
  
  return `${baseUrl}/product/${productId}`;
}

/**
 * Gọi Facebook Share Dialog
 * @returns true nếu user share thành công, false nếu cancel
 */
export async function shareToFacebookDialog(options: ShareOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.FB) {
      console.warn('Facebook SDK not loaded');
      resolve(false);
      return;
    }

    const shareUrl = getShareUrl(options.productId);

    console.log('🔗 Share URL:', shareUrl);
    console.log('📱 Product:', options.productName);
    console.log('🖼️ Image:', options.productImage);

    // Tạo Share Dialog params
    const shareParams: any = {
      method: 'share',
      href: shareUrl,
      hashtag: 'Hãy đến với Hoa Quả Sơn và tìm mua những hoa quả chất lượng cao\n#hoaquason #nongsan #fresh #vietnam',
    };

    // Thêm picture nếu có (Facebook sẽ crawl OG tags từ URL, nhưng picture param là fallback)
    if (options.productImage) {
      shareParams.picture = options.productImage;
    }

    window.FB.ui(shareParams, (response: any) => {
      if (response && !response.error_code) {
        console.log('✅ Share successful');
        resolve(true);
      } else {
        console.log('❌ Share cancelled or error');
        resolve(false);
      }
    });
  });
}

/**
 * Declare Facebook SDK types
 */
declare global {
  interface Window {
    FB: any;
  }
}
