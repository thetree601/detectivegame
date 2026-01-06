/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
      remotePatterns: [],
      // 로컬 이미지에 대해서는 unoptimized 사용
      unoptimized: true,
    },
  };
  
  export default nextConfig;