import React, { useState } from 'react';
import { X, Save, BrainCircuit, Plus, Trash2, Edit2, Sparkles, Loader2 } from 'lucide-react';
import { MemoryEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface MemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  memoryEntries: MemoryEntry[];
  onSaveEntries: (entries: MemoryEntry[]) => void;
  // Keep notes for backward compatibility
  notes: string;
  onSaveNotes: (notes: string) => void;
  onExtractMemory: () => Promise<void>;
}

export function MemoryPanel({ isOpen, onClose, memoryEntries = [], onSaveEntries, notes, onSaveNotes, onExtractMemory }: MemoryPanelProps) {
  const [localEntries, setLocalEntries] = useState<MemoryEntry[]>(memoryEntries);
  const [localNotes, setLocalNotes] = useState(notes);
  const [isSaved, setIsSaved] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'entries' | 'notes'>('entries');
  
  const [isEditingEntry, setIsEditingEntry] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<Partial<MemoryEntry>>({});

  // Sync with props
  React.useEffect(() => {
    setLocalEntries(memoryEntries || []);
    setLocalNotes(notes || '');
  }, [memoryEntries, notes]);

  const handleSaveAll = () => {
    onSaveEntries(localEntries);
    onSaveNotes(localNotes);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleAddEntry = () => {
    const newEntry: MemoryEntry = {
      id: uuidv4(),
      category: 'character',
      name: '',
      content: ''
    };
    setEditingEntry(newEntry);
    setIsEditingEntry(newEntry.id);
  };

  const handleSaveEntry = () => {
    if (editingEntry.id) {
      const isExisting = localEntries.some(e => e.id === editingEntry.id);
      if (isExisting) {
        setLocalEntries(localEntries.map(e => e.id === editingEntry.id ? editingEntry as MemoryEntry : e));
      } else {
        setLocalEntries([...localEntries, editingEntry as MemoryEntry]);
      }
    }
    setIsEditingEntry(null);
    setEditingEntry({});
  };

  const handleDeleteEntry = (id: string) => {
    setLocalEntries(localEntries.filter(e => e.id !== id));
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'character': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'plot': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'world': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'event': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      default: return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'character': return 'Personaje';
      case 'plot': return 'Trama';
      case 'world': return 'Mundo';
      case 'event': return 'Evento';
      default: return category;
    }
  };

  return (
    <div
      className={`absolute right-0 top-0 bottom-0 w-full sm:w-96 z-40 bg-zinc-950 border-l border-zinc-800 flex flex-col transform transition-transform duration-300 ease-in-out shadow-2xl ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="p-4 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <BrainCircuit size={18} className="text-indigo-400" />
          <h2 className="font-semibold text-white">Memoria a Largo Plazo</h2>
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-zinc-800">
          <X size={20} />
        </button>
      </div>

      <div className="flex border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        <button
          onClick={() => setActiveTab('entries')}
          className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'entries' ? 'text-indigo-400 border-indigo-400' : 'text-zinc-400 border-transparent hover:text-zinc-300'
          }`}
        >
          Lorebook
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'notes' ? 'text-indigo-400 border-indigo-400' : 'text-zinc-400 border-transparent hover:text-zinc-300'
          }`}
        >
          Notas Rápidas
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
        {activeTab === 'notes' ? (
          <>
            <p className="text-xs text-zinc-400">
              Escribe aquí apuntes rápidos sin estructura.
            </p>
            <textarea
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-200 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              placeholder="Ej: El protagonista se llama Kael y tiene fobia al agua..."
            />
          </>
        ) : (
          <>
            {!isEditingEntry ? (
              <>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-zinc-400">Entradas estructuradas de Lore</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        setIsExtracting(true);
                        await onExtractMemory();
                        setIsExtracting(false);
                      }}
                      disabled={isExtracting}
                      className="flex items-center gap-1 text-xs bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 disabled:opacity-50 px-2 py-1 rounded transition-colors"
                      title="Helk analizará los últimos mensajes y extraerá información clave."
                    >
                      {isExtracting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} 
                      Auto-Extraer
                    </button>
                    <button
                      onClick={handleAddEntry}
                      className="flex items-center gap-1 text-xs bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 px-2 py-1 border border-indigo-600/30 rounded"
                    >
                      <Plus size={14} /> Nueva
                    </button>
                  </div>
                </div>
                
                {localEntries.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center text-zinc-500 text-sm border-2 border-dashed border-zinc-800 rounded-xl p-6">
                    No hay entradas de memoria. Aquí podrás guardar personajes, tramas y reglas de tu mundo.
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-2">
                    {localEntries.map(entry => (
                      <div key={entry.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 group">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${getCategoryColor(entry.category)}`}>
                              {getCategoryLabel(entry.category)}
                            </span>
                            <span className="font-medium text-sm text-zinc-200 line-clamp-1">{entry.name}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingEntry(entry);
                                setIsEditingEntry(entry.id);
                              }}
                              className="text-zinc-400 hover:text-indigo-400"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="text-zinc-400 hover:text-red-400"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2">{entry.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium text-white">{editingEntry.name ? 'Editar Entrada' : 'Nueva Entrada'}</h3>
                  <button onClick={() => setIsEditingEntry(null)} className="text-xs text-zinc-400 hover:text-white">Cancelar</button>
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-zinc-400 uppercase font-semibold">Categoría</label>
                  <select
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 outline-none focus:border-indigo-500"
                    value={editingEntry.category}
                    onChange={(e) => setEditingEntry({...editingEntry, category: e.target.value as any})}
                  >
                    <option value="character">Personaje</option>
                    <option value="plot">Trama / Historia</option>
                    <option value="world">Mundo / Lore</option>
                    <option value="event">Evento</option>
                  </select>
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-zinc-400 uppercase font-semibold">Nombre / Título</label>
                  <input
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 outline-none focus:border-indigo-500"
                    placeholder="Ej: Kael, Reino de Fuego..."
                    value={editingEntry.name || ''}
                    onChange={(e) => setEditingEntry({...editingEntry, name: e.target.value})}
                  />
                </div>

                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs text-zinc-400 uppercase font-semibold">Detalles y Contenido</label>
                  <textarea
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 resize-none outline-none focus:border-indigo-500"
                    placeholder="Escribe la información clave que Helk debe recordar..."
                    value={editingEntry.content || ''}
                    onChange={(e) => setEditingEntry({...editingEntry, content: e.target.value})}
                  />
                </div>

                <button
                  onClick={handleSaveEntry}
                  disabled={!editingEntry.name?.trim() || !editingEntry.content?.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={16} /> Guardar Entrada
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {!isEditingEntry && (
        <div className="p-4 border-t border-zinc-800 bg-zinc-900 shrink-0">
          <button
            onClick={handleSaveAll}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-colors font-medium ${
              isSaved ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white`}
          >
            <Save size={18} />
            {isSaved ? 'Cambios Guardados' : 'Guardar Todo'}
          </button>
        </div>
      )}
    </div>
  );
}
