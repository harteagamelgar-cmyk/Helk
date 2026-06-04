import React from 'react';
import { X, Monitor, Type, Layout } from 'lucide-react';

export type AppSettings = {
  fontSize: 'small' | 'normal' | 'large';
  chatWidth: 'narrow' | 'normal' | 'wide' | 'full';
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

export function SettingsModal({ isOpen, onClose, settings, onUpdateSettings }: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Monitor size={20} className="text-indigo-400" />
            Ajustes de Pantalla
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Tamaño de texto */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Type size={16} />
              Tamaño de texto
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['small', 'normal', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => onUpdateSettings({ ...settings, fontSize: size })}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    settings.fontSize === size
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-950 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {size === 'small' ? 'Pequeño' : size === 'normal' ? 'Normal' : 'Grande'}
                </button>
              ))}
            </div>
          </div>

          {/* Ancho del chat */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Layout size={16} />
              Ancho del chat
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['narrow', 'normal', 'wide', 'full'] as const).map((width) => (
                <button
                  key={width}
                  onClick={() => onUpdateSettings({ ...settings, chatWidth: width })}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    settings.chatWidth === width
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-950 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {width === 'narrow' ? 'Estrecho' : width === 'normal' ? 'Normal' : width === 'wide' ? 'Ancho' : 'Completo'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
