import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, Tone, WritingConfig } from '../types';
import { Send, Bot, User, Loader2, Sparkles, PenTool, Search, HelpCircle, Copy, Check, RefreshCw, Zap, Crown, SlidersHorizontal, UserPlus, Map, Swords, Eye, AlignLeft, Volume2, Square, Star, Feather, Image as ImageIcon } from 'lucide-react';
import Markdown from 'react-markdown';
import { AppSettings } from './SettingsModal';
import { STYLES, PERSPECTIVES } from './WritingSetupModal';

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  onGenerateImage?: (prompt: string) => void;
  isLoading: boolean;
  onRegenerate: () => void;
  settings: AppSettings;
  currentTone?: Tone;
  onToneChange: (tone: Tone) => void;
  onTogglePin: (messageId: string) => void;
  writingConfig?: WritingConfig;
  onEditMessage?: (messageId: string, content: string) => void;
}

const QUICK_ACTIONS = [
  { label: 'Mejorar diálogo', icon: <PenTool size={14} />, prompt: 'Mejora el siguiente diálogo para que suene más natural y acorde a los personajes: \n\n' },
  { label: 'Expandir escena', icon: <Sparkles size={14} />, prompt: 'Expande la siguiente escena añadiendo más descripciones sensoriales y profundidad emocional: \n\n' },
  { label: 'Revisar ortografía', icon: <Search size={14} />, prompt: 'Revisa la ortografía y gramática del siguiente texto, y sugiere mejoras de estilo: \n\n' },
  { label: 'Sugerir giro', icon: <HelpCircle size={14} />, prompt: 'Sugiere un giro de trama inesperado pero coherente basado en lo que te he contado hasta ahora sobre la historia.' },
  { label: 'Crear personaje', icon: <UserPlus size={14} />, prompt: 'Crea un perfil de personaje detallado con sus motivaciones, miedos, apariencia y trasfondo basado en esta breve descripción: \n\n' },
  { label: 'Describir lugar', icon: <Map size={14} />, prompt: 'Describe el siguiente escenario con gran detalle sensorial (vista, oído, olfato, tacto), creando una atmósfera inmersiva: \n\n' },
  { label: 'Generar conflicto', icon: <Swords size={14} />, prompt: 'Introduce un nuevo conflicto o un obstáculo inesperado para los personajes en la siguiente situación: \n\n' },
  { label: 'Cambiar perspectiva', icon: <Eye size={14} />, prompt: 'Reescribe el siguiente texto desde la perspectiva de otro personaje o cambiando el tipo de narrador (ej. de 1ª a 3ª persona): \n\n' },
  { label: 'Resumir texto', icon: <AlignLeft size={14} />, prompt: 'Haz un resumen conciso del siguiente texto, destacando los puntos clave de la trama: \n\n' }
];

interface MessageItemProps {
  msg: Message;
  showRegenerate: boolean;
  settings: AppSettings;
  widthClass: string;
  isCopied: boolean;
  onCopy: (id: string, text: string) => void;
  onEdit: (id: string, text: string) => void;
  onTogglePin: (id: string) => void;
  onRegenerate: () => void;
}

const MessageItem = React.memo(({
  msg,
  showRegenerate,
  settings,
  widthClass,
  isCopied,
  onCopy,
  onEdit,
  onTogglePin,
  onRegenerate
}: MessageItemProps) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = () => {
    try {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      } else {
        const utterance = new SpeechSynthesisUtterance(msg.text);
        utterance.lang = 'es-ES'; // Default to Spanish
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
      }
    } catch (e) {
      console.error('Speech synthesis failed', e);
    }
  };

  // Clean up speech synthesis if component unmounts
  useEffect(() => {
    return () => {
      try {
        if (isSpeaking) {
          window.speechSynthesis.cancel();
        }
      } catch (e) {}
    };
  }, [isSpeaking]);

  return (
    <div
      className={`flex gap-4 mx-auto ${widthClass} ${
        msg.role === 'user' ? 'flex-row-reverse' : ''
      }`}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          msg.role === 'user' ? 'bg-indigo-600' : 'bg-zinc-800'
        }`}
      >
        {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
      </div>
      <div
        className={`flex flex-col space-y-2 max-w-[80%] ${
          msg.role === 'user' ? 'items-end' : 'items-start'
        }`}
      >
        {msg.role === 'model' && msg.modelType && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-1 ml-1">
            {msg.modelType === 'rapid' ? (
              <>
                <Zap size={12} className="text-yellow-500" />
                <span>Helk Rapid</span>
              </>
            ) : (
              <>
                <Crown size={12} className="text-yellow-500" />
                <span>Helk PRIME</span>
              </>
            )}
          </div>
        )}
        <div
          className={`px-5 py-3 rounded-2xl ${
            msg.role === 'user'
              ? 'bg-indigo-600 text-white rounded-tr-sm'
              : 'bg-zinc-900 text-zinc-200 rounded-tl-sm border border-zinc-800'
          }`}
        >
          {msg.imageUrl && (
            <div className="mb-3 rounded-xl overflow-hidden border border-zinc-800/50 bg-zinc-950">
              <img src={msg.imageUrl} alt="Generated" className="w-full h-auto max-h-[400px] object-contain" referrerPolicy="no-referrer" />
            </div>
          )}
          {msg.role === 'user' ? (
            <p className="whitespace-pre-wrap">{msg.text}</p>
          ) : (
            <div className={`markdown-body prose prose-invert max-w-none ${settings.fontSize === 'small' ? 'prose-sm' : settings.fontSize === 'large' ? 'prose-lg' : ''}`}>
              <Markdown>{msg.text}</Markdown>
            </div>
          )}
        </div>
        
        {/* Message Actions */}
        <div className={`flex items-center gap-3 mt-1 text-zinc-500 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <button
            onClick={() => onCopy(msg.id, msg.text)}
            className="flex items-center gap-1 hover:text-zinc-300 transition-colors text-xs"
            title="Copiar mensaje"
          >
            {isCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            {isCopied ? <span className="text-green-500">Copiado</span> : 'Copiar'}
          </button>
          
          <button
            onClick={() => onTogglePin(msg.id)}
            className={`flex items-center gap-1 transition-colors text-xs ${msg.isPinned ? 'text-yellow-500 hover:text-yellow-400' : 'hover:text-zinc-300'}`}
            title={msg.isPinned ? "Desfijar mensaje" : "Fijar mensaje"}
          >
            <Star size={14} className={msg.isPinned ? "fill-yellow-500" : ""} />
            {msg.isPinned ? 'Fijado' : 'Fijar'}
          </button>

          {msg.role === 'model' && (
            <button
              onClick={handleSpeak}
              className={`flex items-center gap-1 transition-colors text-xs ${isSpeaking ? 'text-indigo-400 hover:text-indigo-300' : 'hover:text-zinc-300'}`}
              title={isSpeaking ? "Detener lectura" : "Leer en voz alta"}
            >
              {isSpeaking ? <Square size={14} className="fill-indigo-400" /> : <Volume2 size={14} />}
              {isSpeaking ? 'Detener' : 'Escuchar'}
            </button>
          )}
          
          {msg.role === 'user' && (
            <button
              onClick={() => onEdit(msg.id, msg.text)}
              className="flex items-center gap-1 hover:text-zinc-300 transition-colors text-xs"
              title="Editar mensaje (borrará los siguientes)"
            >
              <PenTool size={14} />
              Editar
            </button>
          )}

          {showRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 hover:text-zinc-300 transition-colors text-xs"
              title="Regenerar respuesta"
            >
              <RefreshCw size={14} />
              Regenerar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.msg === nextProps.msg &&
    prevProps.showRegenerate === nextProps.showRegenerate &&
    prevProps.settings === nextProps.settings &&
    prevProps.widthClass === nextProps.widthClass &&
    prevProps.isCopied === nextProps.isCopied
  );
});

export function ChatArea({ messages, onSendMessage, onGenerateImage, isLoading, onRegenerate, settings, currentTone = 'balanced', onToneChange, onTogglePin, writingConfig, onEditMessage }: ChatAreaProps) {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Stable callbacks for MessageItem
  const onRegenerateRef = useRef(onRegenerate);
  onRegenerateRef.current = onRegenerate;
  const handleRegenerate = useCallback(() => onRegenerateRef.current(), []);

  const onTogglePinRef = useRef(onTogglePin);
  onTogglePinRef.current = onTogglePin;
  const handleTogglePin = useCallback((id: string) => onTogglePinRef.current(id), []);

  const [selectionData, setSelectionData] = useState<{ top: number; left: number; text: string } | null>(null);
  const [isCopiedSelection, setIsCopiedSelection] = useState(false);

  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) {
          setSelectionData(null);
          return;
        }

        const text = selection.toString();
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Calculate positions
        let top = rect.top - 40;
        let left = rect.left + (rect.width / 2);

        setSelectionData({ top, left, text });
        setIsCopiedSelection(false);
      }, 10);
    };

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectionData(null);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const handleCopySelection = () => {
    if (selectionData?.text) {
      navigator.clipboard.writeText(selectionData.text);
      setIsCopiedSelection(true);
      setTimeout(() => {
        setSelectionData(null);
        window.getSelection()?.removeAllRanges();
      }, 1500);
    }
  };

  const wordCount = input.trim() ? input.trim().split(/\s+/).length : 0;
  const charCount = input.length;

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleEdit = useCallback((id: string, text: string) => {
    setInput(text);
    textareaRef.current?.focus();
    if (onEditMessage) {
      onEditMessage(id, text);
    }
  }, [onEditMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const getWidthClass = () => {
    switch (settings.chatWidth) {
      case 'narrow': return 'max-w-2xl';
      case 'wide': return 'max-w-5xl';
      case 'full': return 'max-w-full px-4';
      default: return 'max-w-4xl';
    }
  };

  const getTextSizeClass = () => {
    switch (settings.fontSize) {
      case 'small': return 'text-sm';
      case 'large': return 'text-lg';
      default: return 'text-base';
    }
  };

  const widthClass = getWidthClass();
  const textSizeClass = getTextSizeClass();

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 text-zinc-100 relative">
      {selectionData && (
        <button
          onClick={handleCopySelection}
          className="fixed z-50 transform -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded-lg shadow-xl border border-zinc-700 transition-all"
          style={{ top: selectionData.top, left: selectionData.left }}
        >
          {isCopiedSelection ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          {isCopiedSelection ? 'Copiado' : 'Copiar'}
        </button>
      )}
      <div className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 ${textSizeClass}`}>
        {writingConfig && (
          <div className={`mx-auto ${widthClass} bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4 mb-6 text-sm text-indigo-100 shadow-inner`}>
            <div className="font-semibold flex items-center gap-2 mb-3 text-indigo-300">
              <Feather size={18} /> Modo Escritura Activo
            </div>
            <div className="space-y-2">
              <p><span className="text-indigo-400 font-medium">Género:</span> {writingConfig.genre}</p>
              <p><span className="text-indigo-400 font-medium">Estilo:</span> {STYLES.find(s => s.id === writingConfig.style)?.name || writingConfig.style}</p>
              <p><span className="text-indigo-400 font-medium">Perspectiva:</span> {PERSPECTIVES.find(p => p.id === writingConfig.perspective)?.name || writingConfig.perspective}</p>
            </div>
          </div>
        )}
        {messages.length === 0 && !writingConfig ? (
          <div className="min-h-full flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto py-12">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
              <Bot size={32} className="text-zinc-400" />
            </div>
            <h2 className="text-2xl font-semibold text-zinc-200">Soy Helk</h2>
            <p className="text-zinc-400">
              Tu asistente de escritura. Cuéntame sobre tu historia, tus personajes o el mundo que estás creando. Te ayudaré a mantener la coherencia, recordar detalles y resolver agujeros de guion.
            </p>
          </div>
        ) : messages.length === 0 && writingConfig ? (
          <div className="min-h-full flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto py-12">
            <div className="w-16 h-16 bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
              <Feather size={32} className="text-indigo-400" />
            </div>
            <h2 className="text-2xl font-semibold text-zinc-200 mb-2">El papel te espera</h2>
            <p className="text-zinc-400">
              Escribe tus ideas para el próximo capítulo y Helk las redactará con el estilo que configuraste.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isLastMessage = index === messages.length - 1;
            if (msg.role === 'model' && msg.text === '') return null;
            return (
              <MessageItem
                key={msg.id}
                msg={msg}
                showRegenerate={msg.role === 'model' && isLastMessage && !isLoading}
                onRegenerate={handleRegenerate}
                settings={settings}
                widthClass={widthClass}
                isCopied={copiedId === msg.id}
                onCopy={handleCopy}
                onEdit={handleEdit}
                onTogglePin={handleTogglePin}
              />
            );
          })
        )}
        {isLoading && (!messages.length || messages[messages.length - 1].role !== 'model' || messages[messages.length - 1].text === '') && (
          <div className={`flex gap-4 mx-auto ${widthClass}`}>
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
              <Bot size={20} />
            </div>
            <div className="px-5 py-3 rounded-2xl bg-zinc-900 text-zinc-200 rounded-tl-sm border border-zinc-800 flex items-center">
              <Loader2 size={20} className="animate-spin text-zinc-500" />
              <span className="ml-3 text-zinc-400 text-sm">Helk está pensando...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-zinc-950 border-t border-zinc-800">
        <div className={`mx-auto mb-3 flex flex-wrap items-center justify-between gap-2 px-2 ${widthClass}`}>
          {messages.length === 0 && !writingConfig ? (
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    setInput(action.prompt);
                    if (textareaRef.current) {
                      textareaRef.current.focus();
                    }
                  }}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div className="relative group">
            <button className="text-xs bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5">
              <SlidersHorizontal size={14} />
              Tono: <span className="text-zinc-200 capitalize">{currentTone}</span>
            </button>
            <div className="absolute bottom-full right-0 mb-2 w-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              {(['balanced', 'descriptive', 'direct', 'epic', 'dark', 'dramatic'] as Tone[]).map((t) => (
                <button
                  key={t}
                  onClick={() => onToneChange(t)}
                  className={`px-4 py-2 text-xs text-left transition-colors ${
                    currentTone === t ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <span className="capitalize">{t}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <form
          onSubmit={handleSubmit}
          className={`mx-auto relative flex items-center ${widthClass}`}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe sobre tu historia, pregunta sobre el lore, o pide ayuda..."
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl pl-6 pr-24 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none min-h-[56px] max-h-32"
            rows={1}
            disabled={isLoading}
          />
          <div className="absolute right-3 bottom-3 flex items-center gap-1">
            {onGenerateImage && (
              <button
                type="button"
                onClick={() => {
                  if (input.trim() && !isLoading) {
                    onGenerateImage(input.trim());
                    setInput('');
                  }
                }}
                disabled={!input.trim() || isLoading}
                className="p-2 text-zinc-400 hover:text-pink-400 disabled:text-zinc-600 transition-colors"
                title="Generar imagen anime con este texto"
              >
                <ImageIcon size={20} />
              </button>
            )}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-full transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
        <div className={`mx-auto flex justify-between items-center mt-3 text-xs text-zinc-600 ${widthClass}`}>
          <span>{wordCount} palabras | {charCount} caracteres</span>
          <span>Helk puede cometer errores. Revisa la información importante.</span>
        </div>
      </div>
    </div>
  );
}
