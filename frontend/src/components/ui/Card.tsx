import type { ReactNode } from "react";

export default function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`economic-card ${className}`}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}

