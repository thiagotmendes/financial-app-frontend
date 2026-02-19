import { PropsWithChildren, ReactNode } from 'react';

type Props = PropsWithChildren<{
  title: string;
  right?: ReactNode;
}>;

export function Panel({ title, right, children }: Props) {
  return (
    <section className="rounded-2xl border border-white/20 bg-white/70 p-5 shadow-glow backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-title text-xl font-semibold text-ink">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
