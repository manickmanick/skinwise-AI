import type { ButtonHTMLAttributes, ReactNode } from "react";
type Variant = "primary" | "secondary" | "quiet" | "danger";
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}
export default function Button({
  variant = "primary",
  children,
  className = "",
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={`app-button app-button--${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
