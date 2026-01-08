'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { checkAnswer } from '@/utils/hitDetection';
import { AnswerRegion } from '@/utils/types';
import styles from '@/styles/components.module.css';

interface ImageViewerProps {
  imageSrc: string;
  answerRegions: AnswerRegion[];
  onAnswerCorrect: () => void;
  onAnswerWrong: () => void;
  nextImageSrc?: string;
}

export default function ImageViewer({
  imageSrc,
  answerRegions,
  onAnswerCorrect,
  onAnswerWrong,
  nextImageSrc,
}: ImageViewerProps) {
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Next.js Image의 onLoad 이벤트 사용 (중복 로딩 제거)
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
    setImageLoaded(true);
  };

  // 다음 이미지 preload (현재 이미지 로드 완료 후)
  useEffect(() => {
    if (!nextImageSrc || !imageLoaded) return;

    // Next.js Image 최적화 URL을 사용한 preload
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = nextImageSrc;
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, [nextImageSrc, imageLoaded]);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || imageDimensions.width === 0) return;
  
    const containerRect = containerRef.current.getBoundingClientRect();
    const clickPos = {
      x: e.clientX,
      y: e.clientY,
    };
  
    const imageAspectRatio = imageDimensions.width / imageDimensions.height;
    const containerAspectRatio = containerRect.width / containerRect.height;
  
    let displayedWidth: number;
    let displayedHeight: number;
    let offsetX = 0;
    let offsetY = 0;
  
    if (imageAspectRatio > containerAspectRatio) {
      displayedWidth = containerRect.width;
      displayedHeight = containerRect.width / imageAspectRatio;
      offsetY = (containerRect.height - displayedHeight) / 2;
    } else {
      displayedHeight = containerRect.height;
      displayedWidth = containerRect.height * imageAspectRatio;
      offsetX = (containerRect.width - displayedWidth) / 2;
    }
  
    const imageX = (clickPos.x - containerRect.left - offsetX) / displayedWidth;
    const imageY = (clickPos.y - containerRect.top - offsetY) / displayedHeight;
  
    console.log('클릭 좌표:', {
      x: imageX.toFixed(3),
      y: imageY.toFixed(3),
      pixelX: clickPos.x,
      pixelY: clickPos.y,
    });
  
    const isCorrect = checkAnswer(
      clickPos,
      answerRegions,
      imageDimensions,
      containerRect
    );

    if (isCorrect) {
      onAnswerCorrect();
    } else {
      onAnswerWrong();
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleImageClick}
      className={styles.imageViewerContainer}
    >
      <Image
        ref={imageRef}
        src={imageSrc}
        alt="Case image"
        fill
        className="object-contain"
        priority
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
        quality={85}
        onLoad={handleImageLoad}
      />
    </div>
  );
}