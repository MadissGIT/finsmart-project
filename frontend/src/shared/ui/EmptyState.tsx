import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  children: string;
}

export function EmptyState({ icon: Icon, title, children }: Props) {
  return (
    <section className="panel flex min-h-72 flex-col items-center justify-center text-center">
      <span className="mb-5 rounded-2xl bg-brand-50 p-4 text-brand-700"><Icon size={28} aria-hidden="true" /></span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-stone-500">{children}</p>
    </section>
  );
}
