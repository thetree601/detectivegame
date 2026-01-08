/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // Next.js Image 최적화 활성화 (unoptimized 제거)
    // 이미지 자동 최적화, WebP 변환, lazy loading 등이 자동으로 적용됩니다
  },
};

export default nextConfig;
