import type { CSSProperties } from 'react';
import { transactionAsset } from '../model/presentation';

export function TransactionAsset({ name, style }: { name: string; style?: CSSProperties }) {
  return <img className="transaction-asset" src={transactionAsset(name)} alt="" draggable={false} style={style} />;
}

export function CategoryIcon({ id, picker = false }: { id: number; picker?: boolean }) {
  if (id === 7 && picker) return <span className="transaction-category-icon" aria-hidden="true"><TransactionAsset name="59de0.svg" /></span>;
  const variants: Record<number, [string, string]> = { 2: ['6d18d.svg', 'fee23.svg'], 3: ['b81f9.svg', 'c4f44.svg'], 4: ['3cbaa.svg', 'c7b3c.svg'], 6: ['a24ee.svg', '0635b.svg'], 7: ['4b715.svg', '2f9f8.svg'] };
  const [background, glyph] = variants[id] ?? ['d6df0.svg', '85cb6.svg'];
  return <span className="transaction-category-icon" aria-hidden="true">
    <TransactionAsset name={id === 1 || id === 5 ? (picker || id === 5 ? 'ce262.svg' : '3cbaa.svg') : background} />
    {id === 1 && !picker ? <>
      <TransactionAsset name="615aa.svg" style={{ left: 5, top: 8.0064 }} />
      <TransactionAsset name="c0558.svg" style={{ left: 11.0976, top: 18.192 }} />
      <TransactionAsset name="b5e0d.svg" style={{ left: 16.6768, top: 18.192 }} />
    </> : id === 1 || id === 5 ? <>
      <TransactionAsset name="8d5ce.svg" style={{ left: 7.7632, top: 6 }} />
      <TransactionAsset name="d43fe.svg" style={{ left: 16.544, top: 6.0096 }} />
    </> : <TransactionAsset name={glyph} style={{ left: 6, top: 6 }} />}
  </span>;
}

export function TransactionHero({ categoryId }: { categoryId: number }) {
  return <div className="transaction-hero" aria-hidden="true"><TransactionAsset name="d1f55.svg" /><TransactionAsset name="b16c5.svg" style={{ left: 18, top: 18 }} />
    {categoryId === 1 ? <>
      <TransactionAsset name="aac88.svg" style={{ left: 44, top: 50 }} />
      <TransactionAsset name="192c6.svg" style={{ left: 62.2928, top: 80.576 }} />
      <TransactionAsset name="fe151.svg" style={{ left: 79.0304, top: 80.576 }} />
    </> : <span className="transaction-hero-category"><CategoryIcon id={categoryId} picker /></span>}
  </div>;
}
