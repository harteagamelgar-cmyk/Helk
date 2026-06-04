/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import LZString from 'lz-string';
import { ChatSession, Message } from './types';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { MemoryPanel } from './components/MemoryPanel';
import { SettingsModal, AppSettings } from './components/SettingsModal';
import { WritingSetupModal } from './components/WritingSetupModal';
import { CoverGenerator } from './components/CoverGenerator';
import { generateResponseStream, generateCoverImage, extractMemoryEntries } from './lib/gemini';
import { Menu, X, Download, BookOpen, Zap, Crown, Settings, Trash2, MoreVertical, PanelLeftClose, PanelLeftOpen, Feather, MessageSquare } from 'lucide-react';

import { useFirebase } from './components/FirebaseProvider';
import { syncLocalSessionsToFirebase, fetchSessionsFromFirestore } from './lib/firebase-sync';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from './lib/firebase';

const loadSessions = (): ChatSession[] => {
  try {
    let savedSessions = localStorage.getItem('helk-sessions-guest');
    if (!savedSessions) savedSessions = localStorage.getItem('helk-sessions');
    if (!savedSessions) return [];

    let parsed = null;
    
    // 1. Try parsing as raw JSON (for uncompressed data)
    try {
      parsed = JSON.parse(savedSessions);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Not raw JSON, proceed to decompression
    }

    // 2. Try UTF-16 decompression (this is our primary compression method)
    if (!parsed) {
      try {
        const decompressed = LZString.decompressFromUTF16(savedSessions);
        if (decompressed) {
          parsed = JSON.parse(decompressed);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {
        console.warn('UTF-16 decompression failed', e);
      }
    }

    // 3. Try Base64 decompression (fallback)
    if (!parsed) {
      try {
        const decompressed = LZString.decompressFromBase64(savedSessions);
        if (decompressed) {
          parsed = JSON.parse(decompressed);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {
        console.warn('Base64 decompression failed', e);
      }
    }
      
    // 4. Try Raw decompression (fallback)
    if (!parsed) {
      try {
        const decompressed = LZString.decompress(savedSessions);
        if (decompressed) {
          parsed = JSON.parse(decompressed);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {
        console.warn('Raw decompression failed', e);
      }
    }

  } catch (e) {
    console.error('Critical failure in loadSessions', e);
  }
  return [];
};

export default function App() {
  const { user } = useFirebase();
  const [selectedModel, setSelectedModel] = useState<'rapid' | 'prime'>('rapid');
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    const loaded = loadSessions();
    if (loaded.length > 0) {
      return loaded[0].id;
    }
    return null;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const savedSettings = localStorage.getItem('helk-settings');
      if (savedSettings) {
        return JSON.parse(savedSettings);
      }
    } catch (e) {}
    return { fontSize: 'normal', chatWidth: 'normal' };
  });

  const [loadingSessions, setLoadingSessions] = useState<Record<string, boolean>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return false;
  });
  const [isWritingModalOpen, setIsWritingModalOpen] = useState(false);
  const [convertingSessionId, setConvertingSessionId] = useState<string | null>(null);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'chat' | 'covers'>('chat');

  // Firebase Sync
  useEffect(() => {
    if (user) {
      const syncAndLoad = async () => {
        let localStr = localStorage.getItem('helk-sessions-guest');
        if (!localStr) localStr = localStorage.getItem('helk-sessions');
        let local: ChatSession[] = [];
        if (localStr) {
           try {
              const parsed = JSON.parse(LZString.decompressFromUTF16(localStr) || '[]');
              if (Array.isArray(parsed)) local = parsed;
           } catch(e){}
        }

        if (local.length > 0) {
          await syncLocalSessionsToFirebase(local, user.uid);
          // Clear guest sessions after syncing so they become part of the account
          localStorage.removeItem('helk-sessions-guest');
          localStorage.removeItem('helk-sessions');
        }
        
        const cloudSessions = await fetchSessionsFromFirestore(user.uid);
        setSessions(cloudSessions);
        if (cloudSessions.length > 0 && (!currentSessionId || !cloudSessions.find(s => s.id === currentSessionId))) {
           setCurrentSessionId(cloudSessions[0].id);
        } else if (cloudSessions.length === 0) {
           setCurrentSessionId(null);
        }
      };
      syncAndLoad();
    } else {
      // User logged out
      let localStr = localStorage.getItem('helk-sessions-guest') || localStorage.getItem('helk-sessions');
      let local: ChatSession[] = [];
      if (localStr) {
         try {
            const parsed = JSON.parse(LZString.decompressFromUTF16(localStr) || '[]');
            if (Array.isArray(parsed)) local = parsed;
         } catch(e){}
      }
      setSessions(local);
      if (local.length > 0 && (!currentSessionId || !local.find(s => s.id === currentSessionId))) {
         setCurrentSessionId(local[0].id);
      } else if (local.length === 0) {
         setCurrentSessionId(null);
      }
    }
  }, [user]);

  // Save sessions to localStorage whenever they change, debounced
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        if (!user) {
          const compressed = LZString.compressToUTF16(JSON.stringify(sessions));
          localStorage.setItem('helk-sessions-guest', compressed);
        } else if (sessions.length > 0) {
           // We just sync the currently selected session to minimize writes
           const current = sessions.find(s => s.id === currentSessionId);
           if (current) {
              syncLocalSessionsToFirebase([current], user.uid).catch(console.error);
           }
        }
      } catch (e) {
        console.error('Failed to save sessions', e);
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [sessions, currentSessionId, user]);

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('helk-settings', JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }, [settings]);

  const handleNewSession = React.useCallback(() => {
    const newSession: ChatSession = {
      id: uuidv4(),
      title: 'Nueva historia',
      messages: [],
      updatedAt: Date.now(),
      notes: '',
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setCurrentView('chat');
    setIsSidebarOpen(false);
  }, []);

  const handleWritingModeConfig = (config: import('./types').WritingConfig) => {
    if (convertingSessionId) {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === convertingSessionId) {
            return {
              ...s,
              writingConfig: config,
              title: s.title.startsWith('Historia:') ? s.title : `Historia: ${s.title}`,
            };
          }
          return s;
        })
      );
      setConvertingSessionId(null);
    } else {
      const newSession: ChatSession = {
        id: uuidv4(),
        title: `Historia: ${config.genre.substring(0, 20)}...`,
        messages: [],
        updatedAt: Date.now(),
        writingConfig: config,
      };
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
    }
    setCurrentView('chat');
    setIsWritingModalOpen(false);
    setIsSidebarOpen(false);
  };

  const handleRemoveWritingMode = () => {
    if (!currentSessionId) return;
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === currentSessionId) {
          const { writingConfig, ...rest } = s;
          return {
            ...rest,
            title: s.title.startsWith('Historia: ') ? s.title.substring(10) : s.title.startsWith('Historia:') ? s.title.substring(9) : s.title,
          };
        }
        return s;
      })
    );
    setIsOptionsMenuOpen(false);
  };

  const handleDeleteSession = React.useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setCurrentSessionId((prev) => (prev === id ? null : prev));
    if (user) {
      deleteDoc(doc(db, 'users', user.uid, 'sessions', id)).catch(console.error);
    }
  }, [user]);

  const handleSelectSession = React.useCallback((id: string) => {
    setCurrentSessionId(id);
    setCurrentView('chat');
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  }, []);

  const handleSelectCovers = React.useCallback(() => {
    setCurrentView('covers');
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  }, []);

  const handleNewWritingSessionClick = React.useCallback(() => {
    setConvertingSessionId(null);
    setIsWritingModalOpen(true);
  }, []);

  const handleClearChat = () => {
    if (!currentSessionId) return;
    if (window.confirm('¿Estás seguro de que quieres borrar todos los mensajes de esta historia?')) {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === currentSessionId
            ? { ...session, messages: [], updatedAt: Date.now() }
            : session
        )
      );
    }
  };

  const handleUpdateNotes = (notes: string) => {
    if (!currentSessionId) return;
    setSessions((prev) =>
      prev.map((session) =>
        session.id === currentSessionId
          ? { ...session, notes, updatedAt: Date.now() }
          : session
      )
    );
  };

  const handleUpdateMemory = (memoryEntries: import('./types').MemoryEntry[]) => {
    if (!currentSessionId) return;
    setSessions((prev) =>
      prev.map((session) =>
        session.id === currentSessionId
          ? { ...session, memoryEntries, updatedAt: Date.now() }
          : session
      )
    );
  };

  const handleExtractMemory = async () => {
    if (!currentSessionId) return;
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session || session.messages.length === 0) return;

    try {
      const extracted = await extractMemoryEntries(session.messages);
      if (extracted && extracted.length > 0) {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === currentSessionId) {
              const currentEntries = s.memoryEntries || [];
              const combined = [...currentEntries];
              // Optional: logic to update existing ones, but for now we append
              extracted.forEach(e => combined.push(e));
              return { ...s, memoryEntries: combined, updatedAt: Date.now() };
            }
            return s;
          })
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExport = () => {
    const currentSession = sessions.find((s) => s.id === currentSessionId);
    if (!currentSession) return;

    let content = `# ${currentSession.title}\n\n`;
    
    if (currentSession.notes && currentSession.notes.trim() !== '') {
      content += `## Notas del Lore\n${currentSession.notes}\n\n---\n\n`;
    }

    currentSession.messages.forEach((msg) => {
      content += `### ${msg.role === 'user' ? 'Tú' : 'Helk'}\n${msg.text}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSession.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendMessage = async (text: string) => {
    let targetSessionId = currentSessionId;
    let isNewSession = false;

    if (!targetSessionId) {
      targetSessionId = uuidv4();
      isNewSession = true;
      setCurrentSessionId(targetSessionId);
    }

    const newMessage: Message = {
      id: uuidv4(),
      role: 'user',
      text,
    };

    setSessions((prev) => {
      if (isNewSession) {
        const newSession: ChatSession = {
          id: targetSessionId!,
          title: text.slice(0, 30) + (text.length > 30 ? '...' : ''),
          messages: [newMessage],
          updatedAt: Date.now(),
        };
        return [newSession, ...prev];
      } else {
        return prev.map((session) => {
          if (session.id === targetSessionId) {
            const title =
              session.messages.length === 0
                ? text.slice(0, 30) + (text.length > 30 ? '...' : '')
                : session.title;
            return {
              ...session,
              title,
              messages: [...session.messages, newMessage],
              updatedAt: Date.now(),
            };
          }
          return session;
        });
      }
    });

    setLoadingSessions((prev) => ({ ...prev, [targetSessionId!]: true }));

    const botMessageId = uuidv4();

    try {
      // Get history for the API call (excluding the message we just added)
      const targetSession = sessions.find((s) => s.id === targetSessionId);
      const history = targetSession?.messages || [];
      const notes = targetSession?.notes;
      
      const botMessage: Message = {
        id: botMessageId,
        role: 'model',
        text: '',
        modelType: selectedModel,
      };

      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === targetSessionId) {
            return {
              ...session,
              messages: [...session.messages, botMessage],
              updatedAt: Date.now(),
            };
          }
          return session;
        })
      );

      const stream = generateResponseStream(history, text, notes, targetSession?.memoryEntries || [], selectedModel, targetSession?.tone || 'balanced', targetSession?.writingConfig);
      
      for await (const chunk of stream) {
        setSessions((prev) =>
          prev.map((session) => {
            if (session.id === targetSessionId) {
              const updatedMessages = session.messages.map(msg => 
                msg.id === botMessageId ? { ...msg, text: msg.text + chunk } : msg
              );
              return {
                ...session,
                messages: updatedMessages,
                updatedAt: Date.now(),
              };
            }
            return session;
          })
        );
      }
    } catch (error) {
      console.error('Error generating response:', error);
      
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === targetSessionId) {
            const updatedMessages = session.messages.map(msg => 
              msg.id === botMessageId ? { ...msg, text: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, inténtalo de nuevo.' } : msg
            );
            return {
              ...session,
              messages: updatedMessages,
              updatedAt: Date.now(),
            };
          }
          return session;
        })
      );
    } finally {
      setLoadingSessions((prev) => ({ ...prev, [targetSessionId!]: false }));
    }
  };

  const handleGenerateImage = async (prompt: string) => {
    let targetSessionId = currentSessionId;
    let isNewSession = false;

    if (!targetSessionId) {
      targetSessionId = uuidv4();
      isNewSession = true;
      setCurrentSessionId(targetSessionId);
    }

    const newMessage: Message = {
      id: uuidv4(),
      role: 'user',
      text: prompt,
    };

    setSessions((prev) => {
      if (isNewSession) {
        const newSession: ChatSession = {
          id: targetSessionId!,
          title: prompt.slice(0, 30) + (prompt.length > 30 ? '...' : ''),
          messages: [newMessage],
          updatedAt: Date.now(),
        };
        return [newSession, ...prev];
      } else {
        return prev.map((session) => {
          if (session.id === targetSessionId) {
            const title =
              session.messages.length === 0
                ? prompt.slice(0, 30) + (prompt.length > 30 ? '...' : '')
                : session.title;
            return {
              ...session,
              title,
              messages: [...session.messages, newMessage],
              updatedAt: Date.now(),
            };
          }
          return session;
        });
      }
    });

    setLoadingSessions((prev) => ({ ...prev, [targetSessionId!]: true }));

    const botMessageId = uuidv4();

    try {
      const botMessage: Message = {
        id: botMessageId,
        role: 'model',
        text: 'Generando imagen...',
        modelType: selectedModel,
      };

      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === targetSessionId) {
            return {
              ...session,
              messages: [...session.messages, botMessage],
              updatedAt: Date.now(),
            };
          }
          return session;
        })
      );

      const imageUrl = await generateCoverImage(prompt, '16:9');

      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === targetSessionId) {
            const updatedMessages = session.messages.map(msg => 
              msg.id === botMessageId ? { ...msg, text: 'Aquí tienes la imagen generada:', imageUrl } : msg
            );
            return {
              ...session,
              messages: updatedMessages,
              updatedAt: Date.now(),
            };
          }
          return session;
        })
      );
    } catch (error) {
      console.error('Error generating image:', error);
      
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === targetSessionId) {
            const updatedMessages = session.messages.map(msg => 
              msg.id === botMessageId ? { ...msg, text: 'Lo siento, hubo un error al generar la imagen. Por favor, inténtalo de nuevo.' } : msg
            );
            return {
              ...session,
              messages: updatedMessages,
              updatedAt: Date.now(),
            };
          }
          return session;
        })
      );
    } finally {
      setLoadingSessions((prev) => ({ ...prev, [targetSessionId!]: false }));
    }
  };

  const handleRegenerate = async () => {
    if (!currentSessionId || loadingSessions[currentSessionId]) return;
    const currentSession = sessions.find((s) => s.id === currentSessionId);
    if (!currentSession || currentSession.messages.length === 0) return;

    const messages = [...currentSession.messages];
    const lastMsg = messages[messages.length - 1];
    
    let userText = '';
    let history: Message[] = [];

    if (lastMsg.role === 'model') {
      messages.pop(); // remove model msg
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg && lastUserMsg.role === 'user') {
        userText = lastUserMsg.text;
        history = messages.slice(0, -1); // everything before the last user msg
      }
    } else {
      userText = lastMsg.text;
      history = messages.slice(0, -1);
    }

    if (!userText) return;

    // Optimistically remove the last model message if it existed
    setSessions((prev) =>
      prev.map((s) => (s.id === currentSessionId ? { ...s, messages } : s))
    );

    setLoadingSessions((prev) => ({ ...prev, [currentSessionId]: true }));
    
    const botMessageId = uuidv4();
    
    try {
      const botMessage: Message = { id: botMessageId, role: 'model', text: '', modelType: selectedModel };
      
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, messages: [...s.messages, botMessage], updatedAt: Date.now() }
            : s
        )
      );

      const stream = generateResponseStream(history, userText, currentSession.notes, currentSession.memoryEntries || [], selectedModel, currentSession.tone || 'balanced', currentSession.writingConfig);
      
      for await (const chunk of stream) {
        setSessions((prev) =>
          prev.map((session) => {
            if (session.id === currentSessionId) {
              const updatedMessages = session.messages.map(msg => 
                msg.id === botMessageId ? { ...msg, text: msg.text + chunk } : msg
              );
              return {
                ...session,
                messages: updatedMessages,
                updatedAt: Date.now(),
              };
            }
            return session;
          })
        );
      }
    } catch (error) {
      console.error('Error generating response:', error);
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === currentSessionId) {
            const updatedMessages = session.messages.map(msg => 
              msg.id === botMessageId ? { ...msg, text: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, inténtalo de nuevo.' } : msg
            );
            return {
              ...session,
              messages: updatedMessages,
              updatedAt: Date.now(),
            };
          }
          return session;
        })
      );
    } finally {
      setLoadingSessions((prev) => ({ ...prev, [currentSessionId]: false }));
    }
  };

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const handleTogglePin = (messageId: string) => {
    if (!currentSessionId) return;
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: session.messages.map((msg) =>
              msg.id === messageId ? { ...msg, isPinned: !msg.isPinned } : msg
            ),
          };
        }
        return session;
      })
    );
  };

  const handleEditMessage = (messageId: string) => {
    if (!currentSessionId) return;
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === currentSessionId) {
          const index = session.messages.findIndex(m => m.id === messageId);
          if (index !== -1) {
            return {
              ...session,
              messages: session.messages.slice(0, index),
              updatedAt: Date.now(),
            };
          }
        }
        return session;
      })
    );
  };

  const wordCount = currentSession?.messages.reduce((acc, msg) => acc + msg.text.trim().split(/\s+/).filter(w => w.length > 0).length, 0) || 0;

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 shrink-0 transform transition-all duration-300 ease-in-out md:relative ${
          isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64 md:w-0 md:translate-x-0 md:overflow-hidden'
        }`}
      >
        <div className="w-64 h-full">
          <Sidebar
            sessions={sessions}
            currentSessionId={currentSessionId}
            currentView={currentView}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
            onNewWritingSession={handleNewWritingSessionClick}
            onDeleteSession={handleDeleteSession}
            onSelectCovers={handleSelectCovers}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {currentView === 'covers' ? (
          <CoverGenerator />
        ) : (
          <>
            {/* Header */}
            <header className="flex items-center justify-between p-3 sm:p-4 bg-zinc-900 border-b border-zinc-800 h-16 shrink-0">
              <div className="flex items-center gap-2 overflow-hidden">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2 -ml-2 text-zinc-400 hover:text-white shrink-0"
                  title={isSidebarOpen ? "Ocultar panel lateral" : "Mostrar panel lateral"}
                >
                  {isSidebarOpen ? <PanelLeftClose size={24} /> : <PanelLeftOpen size={24} />}
                </button>
                <h1 className="text-lg font-semibold truncate px-2 hidden sm:block">
                  {currentSession?.title || 'Helk'}
                </h1>
                {currentSession && wordCount > 0 && (
                  <span className="text-xs text-zinc-500 bg-zinc-950 px-2 py-1 rounded-md border border-zinc-800 hidden lg:block ml-2">
                    {wordCount} palabras
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                {/* Model Selector */}
                <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 shrink-0">
                  <button
                    onClick={() => setSelectedModel('rapid')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      selectedModel === 'rapid' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Respuestas rápidas, ideal para ideas"
                  >
                    <Zap size={14} className={selectedModel === 'rapid' ? 'text-yellow-400' : ''} />
                    <span className="hidden sm:inline">Rapid</span>
                  </button>
                  <button
                    onClick={() => setSelectedModel('prime')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      selectedModel === 'prime' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Respuestas de alta calidad, ideal para redacción final"
                  >
                    <Crown size={14} className={selectedModel === 'prime' ? 'text-yellow-400' : ''} />
                    <span className="hidden sm:inline">PRIME</span>
                  </button>
                </div>

                {currentSession && (
                  <>
                    <button
                      onClick={() => setIsNotesOpen(!isNotesOpen)}
                      className={`p-2 rounded-lg transition-colors ${
                        isNotesOpen
                          ? 'bg-indigo-600 text-white'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                      title="Notas del Lore"
                    >
                      <BookOpen size={20} />
                    </button>
                    
                    <div className="relative">
                      <button
                        onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
                        className={`p-2 rounded-lg transition-colors ${
                          isOptionsMenuOpen
                            ? 'bg-zinc-800 text-white'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                        title="Más opciones"
                      >
                        <MoreVertical size={20} />
                      </button>
                      
                      {isOptionsMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsOptionsMenuOpen(false)} />
                          <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col py-1">
                            {!currentSession?.writingConfig && (
                              <button
                                onClick={() => {
                                  setIsWritingModalOpen(true);
                                  setIsOptionsMenuOpen(false);
                                }}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-indigo-400 hover:bg-zinc-800 hover:text-indigo-300 text-left transition-colors"
                              >
                                <Feather size={16} /> Modo Escritura
                              </button>
                            )}
                            {currentSession?.writingConfig && (
                              <button
                                onClick={() => {
                                  setIsWritingModalOpen(true);
                                  setIsOptionsMenuOpen(false);
                                }}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-indigo-400 hover:bg-zinc-800 hover:text-indigo-300 text-left transition-colors"
                              >
                                <Feather size={16} /> Cambiar Estilo
                              </button>
                            )}
                            {currentSession?.writingConfig && (
                              <button
                                onClick={handleRemoveWritingMode}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white text-left transition-colors"
                              >
                                <MessageSquare size={16} /> Volver a Chat Normal
                              </button>
                            )}
                            <button
                              onClick={() => { handleExport(); setIsOptionsMenuOpen(false); }}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white text-left transition-colors"
                            >
                              <Download size={16} /> Exportar historia
                            </button>
                            <button
                              onClick={() => { setIsSettingsOpen(true); setIsOptionsMenuOpen(false); }}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white text-left transition-colors"
                            >
                              <Settings size={16} /> Ajustes visuales
                            </button>
                            <div className="h-px bg-zinc-800 my-1" />
                            <button
                              onClick={() => { handleClearChat(); setIsOptionsMenuOpen(false); }}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-zinc-800 hover:text-red-300 text-left transition-colors"
                            >
                              <Trash2 size={16} /> Borrar chat
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
              <ChatArea
                messages={currentSession?.messages || []}
                onSendMessage={handleSendMessage}
                onGenerateImage={handleGenerateImage}
                isLoading={!!(currentSessionId && loadingSessions[currentSessionId])}
                onRegenerate={handleRegenerate}
                settings={settings}
                currentTone={currentSession?.tone || 'balanced'}
                onToneChange={(tone) => {
                  if (!currentSessionId) return;
                  setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, tone } : s));
                }}
                onTogglePin={handleTogglePin}
                writingConfig={currentSession?.writingConfig}
                onEditMessage={handleEditMessage}
              />
              <MemoryPanel
                isOpen={isNotesOpen}
                onClose={() => setIsNotesOpen(false)}
                notes={currentSession?.notes || ''}
                onSaveNotes={handleUpdateNotes}
                memoryEntries={currentSession?.memoryEntries || []}
                onSaveEntries={handleUpdateMemory}
                onExtractMemory={handleExtractMemory}
              />
            </div>
          </>
        )}
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
      />
      
      <WritingSetupModal
        isOpen={isWritingModalOpen}
        onClose={() => setIsWritingModalOpen(false)}
        onSave={handleWritingModeConfig}
        initialConfig={currentSession?.writingConfig}
      />
    </div>
  );
}
