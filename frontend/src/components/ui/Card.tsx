import type { ReactNode } from "react";

type Props = {
  title?: string;
  tooltip?: string;
  children: ReactNode;
  className?: string;
};

export default function Card({ title, tooltip, children, className = "" }: Props) {
  return (
    <section className={`economic-card ${className}`}>
      {title ? (
        <div className="card-title-row">
          <h2>{title}</h2>
          {tooltip ? (
            <span className="info-tooltip" tabIndex={0} aria-label={tooltip}>
              i
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}