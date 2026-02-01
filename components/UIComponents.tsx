
import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';

// --- Utils ---
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Card (Glass Effect & Apple Style + Dark Mode) ---
export const Card: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn(
    "bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden transition-all duration-300", 
    className
  )}>
    {children}
  </div>
);

export const CardHeader = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <div className={cn("px-6 py-5 border-b border-gray-50 dark:border-slate-800", className)}>{children}</div>
);

export const CardTitle = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <h3 className={cn("text-lg font-bold text-gray-900 dark:text-white tracking-tight", className)}>{children}</h3>
);

export const CardContent = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <div className={cn("p-6", className)}>{children}</div>
);

// --- Modal ---
export const Modal: React.FC<{ isOpen: boolean, onClose: () => void, title: string, children?: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4 md:p-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-white/50 dark:border-slate-700">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate pr-4">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors dark:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar">
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
      primary: "bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-gray-200 shadow-sm border border-transparent hover:shadow-md",
      secondary: "bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-slate-700 border border-transparent",
      outline: "border border-gray-200 dark:border-slate-700 bg-transparent hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-900 dark:text-white",
      ghost: "hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white border-transparent",
      destructive: "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-100 dark:border-red-900/50",
    };
    
    const sizes = {
      sm: "h-8 px-3 text-xs rounded-lg",
      md: "h-11 px-5 py-2.5 rounded-xl text-sm",
      lg: "h-14 px-8 text-lg rounded-2xl",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50 active:scale-95 tracking-tight touch-manipulation",
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
  <label htmlFor={htmlFor} className={cn("text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block ml-1", className)}>
    {children}
  </label>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800 px-4 py-2 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-white focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-sm",
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
    <div className={cn("w-full bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm", className)}>
      {label && <div className="flex justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</span>
          <span className="text-sm font-bold bg-black dark:bg-white text-white dark:text-black px-2 py-0.5 rounded-md">{value}{suffix}</span>
      </div>}
      <input 
        type="range" 
        min={min} 
        max={max} 
        value={value} 
        className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-black dark:accent-white hover:accent-gray-800 transition-all"
        {...props}
      />
    </div>
  );
};

// --- Badge ---
export const Badge = ({ children, className, variant = 'default' }: { children?: React.ReactNode; className?: string, variant?: 'default' | 'outline' | 'green' | 'blue' | 'yellow' }) => {
    const variants = {
        default: "bg-gray-900 dark:bg-white text-white dark:text-black border-transparent",
        outline: "text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900",
        green: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800",
        blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800",
        yellow: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800"
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
          "flex min-h-[100px] w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800 px-4 py-3 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-white focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-sm resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
