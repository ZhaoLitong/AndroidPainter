import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <section className="modal-content">
        <header>
          <h2>{title}</h2>
          <button aria-label="Close dialog" className="icon-button" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        {children}
      </section>
    </dialog>
  );
}
