/**
 * 水果种类表：渲染配色、生成权重。id 与 PRD 图像清单文件名一致。
 */
import type { FruitKindId } from '../game/types';

export interface FruitKind {
  id: FruitKindId;
  label: string;
  /** 果皮主色（整果渲染） */
  rind: string;
  /** 果皮暗部（描边/阴影） */
  rindDark: string;
  /** 切面果肉色（分瓣渲染） */
  flesh: string;
  /** 果汁粒子色 */
  juice: string;
  /** 生成权重 */
  weight: number;
}

export const FRUIT_KINDS: readonly FruitKind[] = [
  {
    id: 'watermelon',
    label: '西瓜',
    rind: '#2f9e44',
    rindDark: '#1b5e20',
    flesh: '#ff5a5a',
    juice: '#ff7b7b',
    weight: 1.4,
  },
  {
    id: 'apple',
    label: '苹果',
    rind: '#e5383b',
    rindDark: '#a4161a',
    flesh: '#fff3d6',
    juice: '#ffd0a1',
    weight: 1.2,
  },
  {
    id: 'orange',
    label: '橙子',
    rind: '#fb8c00',
    rindDark: '#c96a00',
    flesh: '#ffb74d',
    juice: '#ffa726',
    weight: 1.2,
  },
  {
    id: 'banana',
    label: '香蕉',
    rind: '#f4d35e',
    rindDark: '#c9a227',
    flesh: '#fff9c4',
    juice: '#fff176',
    weight: 1.0,
  },
  {
    id: 'kiwi',
    label: '猕猴桃',
    rind: '#8d6e63',
    rindDark: '#5d4037',
    flesh: '#aed581',
    juice: '#9ccc65',
    weight: 1.0,
  },
  {
    id: 'pineapple',
    label: '菠萝',
    rind: '#f9a825',
    rindDark: '#b8860b',
    flesh: '#ffe082',
    juice: '#ffd54f',
    weight: 1.2,
  },
] as const;

const TOTAL_WEIGHT = FRUIT_KINDS.reduce((sum, k) => sum + k.weight, 0);

/** 按权重随机挑选水果种类（spawner 使用） */
export function pickFruitKind(): FruitKind {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const kind of FRUIT_KINDS) {
    roll -= kind.weight;
    if (roll <= 0) return kind;
  }
  return FRUIT_KINDS[0] as FruitKind;
}

export function fruitKindById(id: FruitKindId): FruitKind {
  return FRUIT_KINDS.find((k) => k.id === id) ?? (FRUIT_KINDS[0] as FruitKind);
}
