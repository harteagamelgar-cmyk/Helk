import React, { useState, useEffect } from 'react';
import { X, Feather, Quote, BookOpen } from 'lucide-react';
import { WritingConfig } from '../types';

interface WritingSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: WritingConfig) => void;
  initialConfig?: WritingConfig;
}

export const STYLES = [
  { id: 'lovecraftian', name: 'Lovecraftiano', desc: 'Cósmico, perturbador, adjetivos arcaicos. Ej: "Una geometría no euclidiana asomaba en la bruma."', examples: 'H.P. Lovecraft' },
  { id: 'tolkien', name: 'Épico / Alta Fantasía', desc: 'Detallista, mitológico, solemne. Ej: "Las hojas de Lórien caían mecidas por un viento antiguo."', examples: 'J.R.R. Tolkien' },
  { id: 'hemingway', name: 'Minimalista (Iceberg)', desc: 'Directo, frases cortas, subtexto fuerte. Ej: "Bebieron su café. El tren se fue."', examples: 'Ernest Hemingway' },
  { id: 'poetic', name: 'Lírico / Poético', desc: 'Metáforas, sensorial, ritmo fluido. Ej: "El atardecer sangraba sobre los tejados de obsidiana."', examples: 'Patrick Rothfuss' },
  { id: 'noir', name: 'Noir / Hardboiled', desc: 'Cínico, asfalto mojado, monólogo interno oscuro. Ej: "La ciudad olía a promesas rotas y ginebra barata."', examples: 'Raymond Chandler' },
  { id: 'cyberpunk', name: 'Cyberpunk', desc: 'Neón, jerga técnica, ritmo frenético. Ej: "El cielo tenía el color de un televisor sintonizado en un canal muerto."', examples: 'William Gibson' },
];

export const PERSPECTIVES = [
  { id: '1st', name: 'Primera Persona ("Yo")' },
  { id: '3rd_limited', name: 'Tercera Limitada (Desde un personaje)' },
  { id: '3rd_omniscient', name: 'Tercera Omnisciente (El narrador lo sabe todo)' }
];

export function WritingSetupModal({ isOpen, onClose, onSave, initialConfig }: WritingSetupModalProps) {
  const [style, setStyle] = useState(initialConfig?.style || 'tolkien');
  const [genre, setGenre] = useState(initialConfig?.genre || 'Fantasía');
  const [perspective, setPerspective] = useState(initialConfig?.perspective || '3rd_limited');

  useEffect(() => {
    if (initialConfig) {
      setStyle(initialConfig.style || 'tolkien');
      setGenre(initialConfig.genre || 'Fantasía');
      setPerspective(initialConfig.perspective || '3rd_limited');
    }
  }, [initialConfig, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ style, genre, perspective });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Feather size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">Modo de Escritura</h2>
              <p className="text-sm text-zinc-400">Configura el estilo para generar capítulos</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8 flex-1">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-200 uppercase tracking-wider">
              <BookOpen size={16} className="text-indigo-400" /> Género Literario
            </label>
            <input
              type="text"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder="Ej: Fantasía Oscura, Ciencia Ficción, Terror..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-200 uppercase tracking-wider">
              <Quote size={16} className="text-indigo-400" /> Estilo de Escritura
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    style === s.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900'
                  }`}
                >
                  <h4 className={`font-semibold mb-1 ${style === s.id ? 'text-indigo-300' : 'text-zinc-200'}`}>{s.name}</h4>
                  <p className="text-xs text-zinc-400 mb-2">{s.desc}</p>
                  <p className="text-[10px] text-zinc-500 italic block">Inspirado en: {s.examples}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">Perspectiva</label>
            <select
              value={perspective}
              onChange={(e) => setPerspective(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {PERSPECTIVES.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 flex justify-end gap-3 shrink-0 bg-zinc-950/50">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
}
