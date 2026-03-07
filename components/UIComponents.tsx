
import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';

// --- Utils ---
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Card (Apple Style) ---
export const Card: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn(
    "bg-white dark:bg-zinc-900 border border-black/[0.04] dark:border-white/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] rounded-2xl overflow-hidden transition-all duration-200",
    className
  )}>
    {children}
  </div>
);

export const CardHeader = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <div className={cn("px-6 py-4 border-b border-black/[0.04] dark:border-white/[0.05]", className)}>{children}</div>
);

export const CardTitle = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <h3 className={cn("text-[15px] font-semibold text-zinc-900 dark:text-white tracking-[-0.02em]", className)}>{children}</h3>
);

export const CardContent = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <div className={cn("p-6", className)}>{children}</div>
);

// --- Modal ---
export const Modal: React.FC<{ isOpen: boolean, onClose: () => void, title: string, children?: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-md animate-in fade-in duration-150 pb-10 sm:pb-0">
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-black/[0.05] dark:border-white/[0.08] m-4 relative z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-black/[0.04] dark:border-white/[0.05] flex-shrink-0">
          <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-white tracking-[-0.02em] truncate pr-4">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-500 dark:text-zinc-400">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-black dark:hover:bg-zinc-100 shadow-[0_1px_3px_rgba(0,0,0,0.15)] border border-transparent",
      secondary: "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-black/[0.04] dark:border-white/[0.06]",
      outline: "border border-zinc-200 dark:border-zinc-700 bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-900 dark:text-white",
      ghost: "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border-transparent",
      destructive: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-100 dark:border-red-500/20",
    };

    const sizes = {
      sm: "h-[30px] px-3 text-[12px] rounded-[7px]",
      md: "h-10 px-4 rounded-[10px] text-[13px]",
      lg: "h-12 px-6 text-[15px] rounded-[12px]",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium tracking-[-0.01em] transition-all duration-150 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97] touch-manipulation",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// --- Input & Label ---
export const Label = ({ children, className, htmlFor }: { children?: React.ReactNode; className?: string, htmlFor?: string }) => (
  <label htmlFor={htmlFor} className={cn("text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-500 mb-1.5 block", className)}>
    {children}
  </label>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[10px] border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/60 px-3.5 py-2 text-[13px] text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-black/[0.08] dark:focus:ring-white/[0.08] focus:border-zinc-400 dark:focus:border-zinc-500 focus:bg-white dark:focus:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-150",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

// --- Slider ---
interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'min' | 'max'> {
  value: number;
  min: number;
  max: number;
  label?: string;
  suffix?: string;
  step?: number;
}

export const Slider = ({ value, min, max, label, suffix, className, ...props }: SliderProps) => {
  return (
    <div className={cn("w-full bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm", className)}>
      {label && <div className="flex justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</span>
          <span className="text-sm font-bold bg-black dark:bg-white text-white dark:text-black px-2 py-0.5 rounded-md">{value}{suffix}</span>
      </div>}
      <input 
        type="range" 
        min={min} 
        max={max} 
        value={value} 
        className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-black dark:accent-white hover:accent-gray-800 transition-all"
        {...props}
      />
    </div>
  );
};

// --- Badge ---
export const Badge = ({ children, className, variant = 'default' }: { children?: React.ReactNode; className?: string, variant?: 'default' | 'outline' | 'green' | 'blue' | 'yellow' | 'red' }) => {
    const variants = {
        default: "bg-zinc-900 dark:bg-white text-white dark:text-black border-transparent",
        outline: "text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900",
        green: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800",
        blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800",
        yellow: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800",
        red: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-100 dark:border-red-800"
    }
    return (
        <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors whitespace-nowrap", variants[variant], className)}>
            {children}
        </div>
    )
}

// --- Textarea ---
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[100px] w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 px-4 py-3 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 dark:text-white focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-sm resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            "flex h-12 w-full appearance-none rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-sm",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
          <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
    );
  }
);
Select.displayName = "Select";
