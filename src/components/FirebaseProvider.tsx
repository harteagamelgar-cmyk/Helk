import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDocFromServer } from 'firebase/firestore';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  logOut: async () => {},
});

export const useFirebase = () => useContext(FirebaseContext);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('the client is offline') || error.message.includes('network-request-failed') || error.message.includes('Backend didn\'t respond within 10 seconds')) {
             console.warn("No se pudo conectar a Firebase (posible problema de red o conexión).", error.message);
          } else if (error.message.includes('unavailable')) {
             console.warn("Conexión con Firebase no disponible temporalmente. Si esto persiste, verifica que no estás usando un bloqueador de anuncios (AdBlock) que pueda estar bloqueando la conexión a Firestore, o intenta recargar la página más tarde ya que las bases de datos nuevas pueden tardar unos minutos en propagarse.");
          } else if (error.message.includes('Missing or insufficient permissions')) {
             // Connection successful! (We don't have access to this test doc, which is expected based on firestore.rules)
          } else {
             console.error("Error connecting to Firebase:", error.message);
          }
        }
      }
    }
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        // Ignorar si el usuario cierra el popup voluntariamente
        console.warn('El usuario cerró la ventana de inicio de sesión.');
      } else {
        console.error('Error al iniciar sesión:', error);
        throw error;
      }
    }
  };

  const logOut = async () => {
    await signOut(auth);
  };

  return (
    <FirebaseContext.Provider value={{ user, loading, signIn, logOut }}>
      {children}
    </FirebaseContext.Provider>
  );
}
