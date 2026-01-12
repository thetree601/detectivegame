/**
 * 코인 상품 패키지 정의
 * Phase 2: 코인 충전 시스템에서 사용
 */

export interface CoinProduct {
  id: string;
  name: string;
  baseCoins: number;
  bonusCoins: number;
  totalCoins: number;
  price: number;
  discountRate: number; // 할인율 (%)
}

export const COIN_PRODUCTS: CoinProduct[] = [
  {
    id: "COIN_PACK_A",
    name: "코인 패키지 A",
    baseCoins: 10,
    bonusCoins: 1,
    totalCoins: 11,
    price: 1000,
    discountRate: 10, // 10코인 기준 1코인 보너스 = 10% 할인
  },
  {
    id: "COIN_PACK_B",
    name: "코인 패키지 B",
    baseCoins: 20,
    bonusCoins: 3,
    totalCoins: 23,
    price: 2000,
    discountRate: 15, // 20코인 기준 3코인 보너스 = 15% 할인
  },
  {
    id: "COIN_PACK_C",
    name: "코인 패키지 C",
    baseCoins: 30,
    bonusCoins: 5,
    totalCoins: 35,
    price: 3000,
    discountRate: 17, // 30코인 기준 5코인 보너스 = 약 17% 할인
  },
  {
    id: "COIN_PACK_D",
    name: "코인 패키지 D",
    baseCoins: 50,
    bonusCoins: 10,
    totalCoins: 60,
    price: 5000,
    discountRate: 20, // 50코인 기준 10코인 보너스 = 20% 할인
  },
  {
    id: "COIN_PACK_E",
    name: "코인 패키지 E",
    baseCoins: 80,
    bonusCoins: 20,
    totalCoins: 100,
    price: 8000,
    discountRate: 25, // 80코인 기준 20코인 보너스 = 25% 할인
  },
  {
    id: "COIN_PACK_F",
    name: "코인 패키지 F",
    baseCoins: 100,
    bonusCoins: 30,
    totalCoins: 130,
    price: 10000,
    discountRate: 30, // 100코인 기준 30코인 보너스 = 30% 할인
  },
];

/**
 * 상품 ID로 상품 정보 조회
 */
export function getCoinProduct(productId: string): CoinProduct | undefined {
  return COIN_PRODUCTS.find((product) => product.id === productId);
}
