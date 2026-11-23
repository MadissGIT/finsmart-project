import { useEffect, useId, useRef } from 'react';
import type { PropsWithChildren } from 'react';
import { TransactionAsset } from './CategoryIcon';

interface Props extends PropsWithChildren { title: string; onClose: () => void; busy?: boolean; variant?: 'bottom' | 'side' | 'center' }

export function TransactionSheet({ title, onClose, busy = false, variant = 'bottom', children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={ref} className={'transaction-sheet transaction-sheet-' + variant} aria-labelledby={id} aria-busy={busy}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => { const box = event.currentTarget.getBoundingClientRect(); if (!busy && event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) onClose(); }}>
    {variant === 'bottom' ? <div className="transaction-sheet-grip"><TransactionAsset name="a2f3c.svg" /></div> : null}
    <header className="transaction-sheet-heading"><h2 id={id}>{title}</h2><button type="button" className="transaction-icon-button" onClick={onClose} disabled={busy} aria-label="Закрыть"><TransactionAsset name="46e58.svg" /></button></header>
    {children}
  </dialog>;
}
