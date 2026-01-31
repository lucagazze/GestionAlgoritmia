
import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';

// --- Utils ---
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Card (Glass Effect & Apple Style) ---
export const Card: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn("bg-white border border-gray-100 shadow-sm rounded-3xl overflow-hidden transition-all duration-300", className)}>
    {children}
  </div>
);

export const CardHeader = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <div className={cn("px-6 py-5 border-b border-gray-50", className)}>{children}</div>
);

export const CardTitle = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <h3 className={cn("text-lg font-bold text-gray-900 tracking-tight", className)}>{children}</h3>
);

export const CardContent = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <div className={cn("p-6", className)}>{children}</div>
);

// --- Modal ---
export const Modal: React.FC<{ isOpen: boolean, onClose: () => void, title: string, children?: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/20 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 border border-white/50">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">
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
      primary: "bg-gray-900 text-white hover:bg-black shadow-sm border border-transparent hover:shadow-md",
      secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 border border-transparent",
      outline: "border border-gray-200 bg-transparent hover:bg-gray-50 text-gray-900",
      ghost: "hover:bg-gray-100 text-gray-600 hover:text-black border-transparent",
      destructive: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100",
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
          "inline-flex items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50 active:scale-95 tracking-tight",
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
  <label htmlFor={htmlFor} className={cn("text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block ml-1", className)}>
    {children}
  </label>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black focus:bg-white disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-sm",
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
    <div className={cn("w-full bg-white p-4 rounded-xl border border-gray-100 shadow-sm", className)}>
      {label && <div className="flex justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</span>
          <span className="text-sm font-bold bg-black text-white px-2 py-0.5 rounded-md">{value}{suffix}</span>
      </div>}
      <input 
        type="range" 
        min={min} 
        max={max} 
        value={value} 
        className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-black hover:accent-gray-800 transition-all"
        {...props}
      />
    </div>
  );
};

// --- Badge ---
export const Badge = ({ children, className, variant = 'default' }: { children?: React.ReactNode; className?: string, variant?: 'default' | 'outline' | 'green' | 'blue' | 'yellow' }) => {
    const variants = {
        default: "bg-gray-900 text-white border-transparent",
        outline: "text-gray-600 border-gray-200 bg-white",
        green: "bg-emerald-50 text-emerald-700 border-emerald-100",
        blue: "bg-blue-50 text-blue-700 border-blue-100",
        yellow: "bg-amber-50 text-amber-700 border-amber-100"
    }
    return (
        <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors", variants[variant], className)}>
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
          "flex min-h-[100px] w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black focus:bg-white disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-sm resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
