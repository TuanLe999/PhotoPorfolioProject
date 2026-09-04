import { useSyncExternalStore } from 'react';

export type ToastKind = 'info' | 'ok' | 'err';

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

let items: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((fn) => fn());

export function toast(message: string, kind: ToastKind = 'info', ms = 3400) {
  const item: Toast = { id: ++seq, message, kind };
  items = [...items, item];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== item.id);
    emit();
  }, ms);
}

export function Toasts() {
  const list = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => items,
    () => items,
  );

  return (
    <div className="adm-toasts">
      {list.map((item) => (
        <div className={`adm-toast adm-toast--${item.kind}`} key={item.id}>
          {item.message}
        </div>
      ))}
    </div>
  );
}
