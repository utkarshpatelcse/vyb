import type { HTMLAttributes, PropsWithChildren } from "react";

export function ShellCard({
  children,
  className = "",
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div {...props} className={`cl-shell-card ${className}`.trim()}>
      {children}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  copy
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="cl-section-header">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}
