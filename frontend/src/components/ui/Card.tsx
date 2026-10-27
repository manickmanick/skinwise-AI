import type { HTMLAttributes, ReactNode } from "react";
interface Props extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}
export default function Card({ children, className = "", ...props }: Props) {
  return (
    <section className={`app-card ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}
