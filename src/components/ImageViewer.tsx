'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { checkAnswer } from '@/utils/hitDetection';
import { AnswerRegion } from '@/utils/types';

interface ImageViewerProps {
  imageSrc: string;
  answerRegions: AnswerRegion[];
  onAnswerCorrect: () => void;
  onAnswerWrong: () => void;
}

export default function ImageViewer({
  imageSrc,
  answerRegions,
  onAnswerCorrect,
  onAnswerWrong,
}: ImageViewerProps) {
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // 이미지 로드 시 실제 크기 가져오기
  useEffect(() => {
    const img = new window.Image();
    img.src = imageSrc;
    img.onload = () => {
      setImageDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
  }, [imageSrc]);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || imageDimensions.width === 0) return;
  
    const containerRect = containerRef.current.getBoundingClientRect();
    const clickPos = {
      x: e.clientX,
      y: e.clientY,
    };
  
    // 🔍 디버깅: 클릭 위치를 이미지 좌표로 변환
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
  
    // 콘솔에 좌표 출력
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
      className="relative w-full h-full flex items-center justify-center bg-gray-900 cursor-pointer"
    >
      <Image
        ref={imageRef}
        src={imageSrc}
        alt="Case image"
        fill
        className="object-contain"
        priority
      />
    </div>
  );
}