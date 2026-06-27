import React from "react";

interface SkeuoButtonProps {
  variant?: "primary" | "secondary" | "danger" | "success" | "warning" | "lcd";
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  children?: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  key?: React.Key;
}

export default function SkeuoButton({
  children,
  variant = "secondary",
  size = "md",
  selected = false,
  className = "",
  onClick,
  disabled,
  type = "button",
  ...props
}: SkeuoButtonProps) {
  // Classic solid tactile colors matching pocket organizers (no gradients)
  const baseStyles = "click-beep font-mono font-bold uppercase border-2 border-black rounded transition-all duration-75 flex items-center justify-center gap-1 active:translate-x-[3px] active:translate-y-[3px]";
  
  const variantStyles = {
    primary: "bg-[#e5c543] text-black shadow-[4px_4px_0px_#000] hover:bg-[#ebd06a] active:shadow-[1px_1px_0px_#000]",
    secondary: "bg-[#e1e0d3] text-black shadow-[4px_4px_0px_#000] hover:bg-[#ecebe0] active:shadow-[1px_1px_0px_#000]",
    danger: "bg-[#cc3333] text-white shadow-[4px_4px_0px_#000] hover:bg-[#dd4444] active:shadow-[1px_1px_0px_#000]",
    success: "bg-[#339966] text-white shadow-[4px_4px_0px_#000] hover:bg-[#44aa77] active:shadow-[1px_1px_0px_#000]",
    warning: "bg-[#ff9900] text-black shadow-[4px_4px_0px_#000] hover:bg-[#ffaa22] active:shadow-[1px_1px_0px_#000]",
    lcd: "bg-[#8da387] text-[#1b2b1a] border-black shadow-[2px_2px_0px_#000] hover:bg-[#9cb196] active:shadow-[1px_1px_0px_#000] text-xs font-bold"
  };

  const selectedStyles = selected
    ? "translate-x-[3px] translate-y-[3px] shadow-[1px_1px_0px_#000] ring-2 ring-black"
    : "";

  const sizeStyles = {
    sm: "px-2 py-1 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${selectedStyles} ${className} ${disabled ? "opacity-50 cursor-not-allowed active:translate-x-0 active:translate-y-0 active:shadow-[4px_4px_0px_#000]" : ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
