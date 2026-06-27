import React from "react";

interface RetroLcdProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export default function RetroLcd({ title, children, className = "", glow = true }: RetroLcdProps) {
  return (
    <div className={`border-4 border-black bg-[#9cb196] p-3 rounded-md shadow-[inset_4px_4px_6px_rgba(0,0,0,0.5)] font-mono text-[#1e2a1b] relative ${className}`}>
      {title && (
        <div className="absolute -top-3 left-4 bg-black text-[#9cb196] px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded border border-[#9cb196]">
          {title}
        </div>
      )}
      <div className={`w-full h-full ${glow ? "lcd-glow" : ""}`}>
        {children}
      </div>
    </div>
  );
}
