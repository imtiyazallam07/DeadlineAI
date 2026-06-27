import React from "react";

interface NotebookPaperProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export default function NotebookPaper({ children, className = "", title }: NotebookPaperProps) {
  return (
    <div className={`relative border-4 border-black bg-[#fcfbeb] rounded-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col ${className}`}>
      {/* Dynamic Skeuomorphic Binder Spiral/Coils */}
      <div className="bg-[#dcdbc8] border-b-4 border-black py-2 px-6 flex justify-around items-center h-8 relative select-none">
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#b5b4a0]" />
        {[...Array(12)].map((_, i) => (
          <div key={i} className="flex flex-col items-center -mt-4 relative z-10">
            {/* Metal coil hoop */}
            <div className="w-2.5 h-7 bg-zinc-400 border-2 border-black rounded-full shadow-[2px_2px_0px_rgba(0,0,0,0.3)]" />
            {/* Punched hole */}
            <div className="w-3.5 h-3.5 bg-black rounded-full -mt-1.5" />
          </div>
        ))}
      </div>

      {title && (
        <div className="bg-[#ecebe0] border-b-2 border-black px-3 py-2 font-mono text-xs sm:text-sm font-bold uppercase tracking-wide text-black flex items-center justify-between gap-2">
          <span className="truncate" title={title}>{title}</span>
          <div className="flex gap-1 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#cc3333] border border-black" />
            <span className="w-2 h-2 rounded-full bg-[#cc3333] border border-black" />
          </div>
        </div>
      )}

      {/* Lined Notebook Content Area */}
      <div className="notebook-paper flex-1 p-3 pl-8 sm:p-6 sm:pl-14 font-handwritten text-xl text-[#2a2a3e] min-h-[300px]">
        {children}
      </div>
    </div>
  );
}
