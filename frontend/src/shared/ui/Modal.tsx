import { useEffect, useId, useRef } from 'react';
import type { PropsWithChildren } from 'react';
import { X } from 'lucide-react';

interface Props extends PropsWithChildren {
  open: boolean;
  title: string;
  onClose: () => void;
  busy?: boolean;
  className?: string;
}

export function Modal({ open, title, onClose, busy = false, className = '', children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      aria-busy={busy}
      className={'app-dialog ' + className}
      onCancel={(event) => { if (busy) event.preventDefault(); else onClose(); }}
      onClose={onClose}
    >
      <div className="dialog-heading">
        <h2 id={id}>{title}</h2>
        <button type="button" className="icon-button" aria-label="Закрыть" disabled={busy} onClick={onClose}><X size={20} /></button>
      </div>
      {children}
    </dialog>
  );
}
