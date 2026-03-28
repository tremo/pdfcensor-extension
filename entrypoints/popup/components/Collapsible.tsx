import React, { useState } from "react";

interface CollapsibleProps {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function Collapsible({ title, hint, defaultOpen = false, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left mb-1"
      >
        <div>
          <span className="text-sm text-gray-400">{title}</span>
          {hint && <p className="text-xs text-gray-600">{hint}</p>}
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="bg-gray-900 rounded-lg p-2">
          {children}
        </div>
      )}
    </div>
  );
}
