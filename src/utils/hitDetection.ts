interface AnswerRegion {
    x: number; // 0~1 사이의 비율
    y: number; // 0~1 사이의 비율
    width: number; // 0~1 사이의 비율
    height: number; // 0~1 사이의 비율
  }
  
  interface ClickPosition {
    x: number; // 실제 픽셀 좌표
    y: number; // 실제 픽셀 좌표
  }
  
  interface ImageDimensions {
    width: number; // 이미지 실제 너비
    height: number; // 이미지 실제 높이
  }
  
  /**
   * 클릭한 위치가 정답 영역 안에 있는지 확인
   */
  export function isClickInRegion(
    clickPos: ClickPosition,
    region: AnswerRegion,
    imageDimensions: ImageDimensions,
    containerRect: DOMRect
  ): boolean {
    // 이미지가 컨테이너 안에서 어떻게 표시되는지 계산
    const imageAspectRatio = imageDimensions.width / imageDimensions.height;
    const containerAspectRatio = containerRect.width / containerRect.height;
  
    let displayedWidth: number;
    let displayedHeight: number;
    let offsetX = 0;
    let offsetY = 0;
  
    if (imageAspectRatio > containerAspectRatio) {
      // 이미지가 가로로 더 길면 너비에 맞춤
      displayedWidth = containerRect.width;
      displayedHeight = containerRect.width / imageAspectRatio;
      offsetY = (containerRect.height - displayedHeight) / 2;
    } else {
      // 이미지가 세로로 더 길면 높이에 맞춤
      displayedHeight = containerRect.height;
      displayedWidth = containerRect.height * imageAspectRatio;
      offsetX = (containerRect.width - displayedWidth) / 2;
    }
  
    // 클릭 위치를 이미지 좌표계로 변환
    const imageX = (clickPos.x - containerRect.left - offsetX) / displayedWidth;
    const imageY = (clickPos.y - containerRect.top - offsetY) / displayedHeight;
  
    // 정답 영역 안에 있는지 확인
    return (
      imageX >= region.x &&
      imageX <= region.x + region.width &&
      imageY >= region.y &&
      imageY <= region.y + region.height
    );
  }
  
  /**
   * 여러 정답 영역 중 하나라도 맞는지 확인
   */
  export function checkAnswer(
    clickPos: ClickPosition,
    regions: AnswerRegion[],
    imageDimensions: ImageDimensions,
    containerRect: DOMRect
  ): boolean {
    return regions.some((region) =>
      isClickInRegion(clickPos, region, imageDimensions, containerRect)
    );
  }