
import React from 'react';
import { Modal } from './UIComponents';
import { Trash2, Edit2, Plus, CheckCircle2, X } from 'lucide-react';

interface ActionDetail {
    id: string;
    type: 'TASK' | 'PROJECT' | 'CONTRACTOR';
    title: string;
    subtitle?: string;
    metadata?: Record<string, any>;
}

interface ActionDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    actionType: 'DELETE' | 'CREATE' | 'UPDATE';
    items: ActionDetail[];
    onUndo?: () => void;
}

export const ActionDetailsModal: React.FC<ActionDetailsModalProps> = ({
    isOpen,
    onClose,
    actionType,
    items,
    onUndo
}) => {
    const getIcon = () => {
        switch (actionType) {
            case 'DELETE': return <Trash2 className="w-5 h-5 text-red-500" />;
            case 'CREATE': return <Plus className="w-5 h-5 text-green-500" />;
            case 'UPDATE': return <Edit2 className="w-5 h-5 text-blue-500" />;
        }
    };

    const getTitle = () => {
        const verb = actionType === 'DELETE' ? 'Borradas' : actionType === 'CREATE' ? 'Creadas' : 'Modificadas';
        return `${items.length} ${items[0]?.type === 'TASK' ? 'Tareas' : 'Items'} ${verb}`;
    };

    const getActionColor = () => {
        switch (actionType) {
            case 'DELETE': return 'bg-red-50 border-red-200 text-red-700';
            case 'CREATE': return 'bg-green-50 border-green-200 text-green-700';
            case 'UPDATE': return 'bg-blue-50 border-blue-200 text-blue-700';
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="">
            <div className="space-y-4">
                {/* Header */}
                <div className={`flex items-center gap-3 p-4 rounded-xl border ${getActionColor()}`}>
                    {getIcon()}
                    <div className="flex-1">
                        <h3 className="font-bold text-lg">{getTitle()}</h3>
                        <p className="text-sm opacity-75">Detalles de la operación realizada</p>
                    </div>
                    {onUndo && actionType === 'DELETE' && (
                        <button
                            onClick={onUndo}
                            className="px-4 py-2 bg-white border border-current rounded-lg font-semibold hover:bg-red-100 transition-colors text-sm"
                        >
                            Deshacer Todo
                        </button>
                    )}
                </div>

                {/* Items List */}
                <div className="max-h-[400px] overflow-y-auto space-y-2 custom-scrollbar">
                    {items.map((item, idx) => (
                        <div
                            key={item.id || idx}
                            className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 hover:shadow-md transition-all"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                                        {item.title}
                                    </h4>
                                    {item.subtitle && (
                                        <p className="text-xs text-gray-500 mt-1">{item.subtitle}</p>
                                    )}
                                    {item.metadata && (
                                        <div className="flex gap-2 mt-2 flex-wrap">
                                            {Object.entries(item.metadata).map(([key, value]) => (
                                                <span
                                                    key={key}
                                                    className="text-[10px] px-2 py-0.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-full text-gray-600 dark:text-gray-300"
                                                >
                                                    {key}: {String(value)}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {actionType === 'DELETE' && (
                                    <CheckCircle2 className="w-5 h-5 text-red-500 flex-shrink-0" />
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg font-semibold transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </Modal>
    );
};
