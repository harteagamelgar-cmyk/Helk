import React, { useState } from 'react';
import { ChatSession } from '../types';
import { PlusCircle, MessageSquare, Trash2, Search, Feather, Image as ImageIcon, LogIn, LogOut } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFirebase } from './FirebaseProvider';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  currentView: 'chat' | 'covers';
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onNewWritingSession: () => void;
  onDeleteSession: (id: string) => void;
  onSelectCovers: () => void;
}

const SessionItem = React.memo(({ 
  session, 
  isActive, 
  onClick, 
  onDelete 
}: { 
  session: ChatSession, 
  isActive: boolean, 
  onClick: (id: string) => void, 
  onDelete: (id: string) => void 
}) => {
  return (
    <div
      className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? 'bg-zinc-800 text-white'
          : 'hover:bg-zinc-800/50'
      }`}
      onClick={() => onClick(session.id)}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        {session.writingConfig ? (
          <Feather size={18} className="shrink-0 text-indigo-400" />
        ) : (
          <MessageSquare size={18} className="shrink-0 text-zinc-500" />
        )}
        <div className="flex flex-col overflow-hidden">
          <span className="truncate font-medium text-sm">
            {session.title || 'Nueva historia'}
          </span>
          <span className="text-xs text-zinc-500 truncate">
            {formatDistanceToNow(session.updatedAt || Date.now(), { addSuffix: true, locale: es })}
          </span>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(session.id);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
        title="Eliminar chat"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
});

export const Sidebar = React.memo(function Sidebar({
  sessions,
  currentSessionId,
  currentView,
  onSelectSession,
  onNewSession,
  onNewWritingSession,
  onDeleteSession,
  onSelectCovers,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { user, loading, signIn, logOut } = useFirebase();

  const filteredSessions = sessions.filter(session => 
    (session.title || 'Nueva historia').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full text-zinc-300">
      <div className="p-4 flex flex-col gap-3">
        <div className="flex gap-2">
          <button
            onClick={onNewSession}
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded-lg transition-colors text-sm"
            title="Nuevo Chat Normal"
          >
            <PlusCircle size={16} />
            <span>Chat</span>
          </button>
          <button
            onClick={onNewWritingSession}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3 py-2 rounded-lg transition-colors text-sm"
            title="Nuevo Modo Escritura"
          >
            <Feather size={16} />
            <span>Escritura</span>
          </button>
        </div>
        
        <button
          onClick={onSelectCovers}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm border ${
            currentView === 'covers' 
              ? 'bg-pink-600/20 text-pink-300 border-pink-500/30' 
              : 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 border-zinc-700/50'
          }`}
          title="Generador de Portadas Anime"
        >
          <ImageIcon size={16} />
          <span>Generador de Portadas</span>
        </button>
        
        {sessions.length > 0 && (
          <div className="relative mt-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar chat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 text-sm rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.length > 0 && (
          <div className="px-2 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Chats recientes
          </div>
        )}
        {filteredSessions.map((session) => (
          <SessionItem
            key={session.id}
            session={session}
            isActive={currentSessionId === session.id && currentView === 'chat'}
            onClick={onSelectSession}
            onDelete={onDeleteSession}
          />
        ))}
        {sessions.length === 0 && (
          <div className="text-center text-zinc-500 text-sm mt-8 px-4">
            No tienes historias guardadas. Crea un nuevo proyecto para empezar.
          </div>
        )}
        {sessions.length > 0 && filteredSessions.length === 0 && (
          <div className="text-center text-zinc-500 text-sm mt-8 px-4">
            No se encontraron chats con ese nombre.
          </div>
        )}
      </div>
      
      {/* Auth Section */}
      <div className="p-4 border-t border-zinc-800 shrink-0">
        {!loading && (
          user ? (
            <div className="flex flex-col gap-2">
              <div className="text-xs text-zinc-500 truncate">{user.email}</div>
              <button
                onClick={logOut}
                className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-lg transition-colors text-sm"
              >
                <LogOut size={16} /> Cerrar sesión
              </button>
            </div>
          ) : (
            <button
              onClick={signIn}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg transition-colors text-sm"
            >
              <LogIn size={16} /> Iniciar con Google
            </button>
          )
        )}
      </div>
    </div>
  );
});
