
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  shortcut?: string;
}

interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  items: ContextMenuItem[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, isOpen, onClose, items }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Prevent menu from going off-screen
  const adjustedX = window.innerWidth - x < 200 ? x - 200 : x;
  const adjustedY = window.innerHeight - y < items.length * 40 ? y - (items.length * 40) : y;

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] cursor-default" 
      onContextMenu={(e) => e.preventDefault()} // Prevent native menu on overlay
    >
        <div 
            ref={menuRef}
            style={{ top: adjustedY, left: adjustedX }}
            className="absolute bg-white/95 backdrop-blur-xl border border-gray-200 rounded-xl shadow-2xl min-w-[180px] py-1.5 animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
        >
            {items.map((item, idx) => {
                const Icon = item.icon;
                return (
                    <button
                        key={idx}
                        onClick={(e) => { 
                            e.stopPropagation();
                            // Close menu FIRST to prevent blocking UI if the action opens a modal/alert
                            onClose(); 
                            // Execute action in next tick to allow UI to update
                            setTimeout(() => item.onClick(), 0);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 transition-colors
                            ${item.variant === 'destructive' 
                                ? 'text-red-600 hover:bg-red-50' 
                                : 'text-gray-700 hover:bg-black hover:text-white'
                            }
                        `}
                    >
                        {Icon && <Icon className="w-3.5 h-3.5" />}
                        <span className="flex-1">{item.label}</span>
                        {item.shortcut && <span className="text-[9px] opacity-50">{item.shortcut}</span>}
                    </button>
                )
            })}
        </div>
    </div>,
    document.body
  );
};
