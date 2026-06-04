import React, { useState, useEffect } from 'react';
import { generateCoverImage } from '../lib/gemini';
import { Image as ImageIcon, Download, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import LZString from 'lz-string';

interface GeneratedCover {
  id: string;
  url: string;
  prompt: string;
  aspectRatio: string;
  createdAt: number;
}

const CoverItem = React.memo(({ cover, onDownload, onDelete }: { cover: GeneratedCover, onDownload: (cover: GeneratedCover) => void, onDelete: (id: string) => void }) => {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group">
      <div className="relative aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden">
        <img
          src={cover.url}
          alt={cover.prompt}
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button
            onClick={() => onDownload(cover)}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-colors"
            title="Descargar"
          >
            <Download size={20} />
          </button>
          <button
            onClick={() => onDelete(cover.id)}
            className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-lg backdrop-blur-sm transition-colors"
            title="Eliminar"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>
      <div className="p-4">
        <p className="text-sm text-zinc-300 line-clamp-2" title={cover.prompt}>
          {cover.prompt}
        </p>
        <div className="flex items-center justify-between mt-3 text-xs text-zinc-500">
          <span>{cover.aspectRatio}</span>
          <span>{new Date(cover.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
});

const loadCovers = (): GeneratedCover[] => {
  try {
    const saved = localStorage.getItem('helk-covers');
    if (!saved) return [];

    let parsed = null;
    
    // 1. Try raw JSON
    try {
      parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}

    // 2. Try UTF-16
    if (!parsed) {
      try {
        const decompressed = LZString.decompressFromUTF16(saved);
        if (decompressed) {
          parsed = JSON.parse(decompressed);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {}
    }

    // 3. Try Base64
    if (!parsed) {
      try {
        const decompressed = LZString.decompressFromBase64(saved);
        if (decompressed) {
          parsed = JSON.parse(decompressed);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {}
    }

    // 4. Try Raw
    if (!parsed) {
      try {
        const decompressed = LZString.decompress(saved);
        if (decompressed) {
          parsed = JSON.parse(decompressed);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {}
    }

  } catch (e) {
    console.error('Failed to parse covers', e);
  }
  return [];
};

export function CoverGenerator() {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "3:4" | "4:3" | "9:16" | "16:9">('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [covers, setCovers] = useState<GeneratedCover[]>(loadCovers);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        const compressed = LZString.compressToUTF16(JSON.stringify(covers));
        localStorage.setItem('helk-covers', compressed);
      } catch (e) {
        console.error('Failed to save covers', e);
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [covers]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const imageUrl = await generateCoverImage(prompt, aspectRatio);
      const newCover: GeneratedCover = {
        id: uuidv4(),
        url: imageUrl,
        prompt,
        aspectRatio,
        createdAt: Date.now(),
      };
      setCovers(prev => [newCover, ...prev]);
    } catch (err) {
      console.error(err);
      setError('Hubo un error al generar la portada. Por favor, inténtalo de nuevo.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = React.useCallback((id: string) => {
    setCovers(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleDownload = React.useCallback((cover: GeneratedCover) => {
    const a = document.createElement('a');
    a.href = cover.url;
    a.download = `portada-anime-${cover.id}.png`;
    a.click();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <ImageIcon size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Generador de Portadas Anime</h2>
              <p className="text-sm text-zinc-400">Crea ilustraciones 2D estilo anime para tus capítulos o historias.</p>
            </div>
          </div>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Descripción de la portada
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ej: Un joven espadachín con cabello plateado mirando hacia un castillo flotante al atardecer, estilo anime épico..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                rows={3}
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Formato (Relación de aspecto)
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as any)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="16:9">16:9 (Paisaje / Pantalla completa)</option>
                  <option value="9:16">9:16 (Retrato / Móvil)</option>
                  <option value="3:4">3:4 (Manga / Cómic)</option>
                  <option value="4:3">4:3 (Clásico)</option>
                  <option value="1:1">1:1 (Cuadrado / Perfil)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isGenerating || !prompt.trim()}
                className="mt-7 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Generando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>Generar Portada</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}
          </form>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          {covers.length === 0 ? (
            <div className="text-center text-zinc-500 mt-12">
              <ImageIcon size={48} className="mx-auto mb-4 opacity-20" />
              <p>No has generado ninguna portada todavía.</p>
              <p className="text-sm mt-1">Tus creaciones aparecerán aquí.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {covers.map((cover) => (
                <CoverItem 
                  key={cover.id} 
                  cover={cover} 
                  onDownload={handleDownload} 
                  onDelete={handleDelete} 
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
