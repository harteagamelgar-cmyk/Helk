import { collection, doc, writeBatch, getDocs, getDoc, Timestamp, setDoc, query, where, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError } from './firebase';
import { ChatSession, Message } from '../types';

// Convert Firestore Timestamp to number
function fromFirestoreTimestamp(ts: any): number {
  if (ts && ts.toMillis) {
    return ts.toMillis();
  }
  return Date.now();
}

export async function syncLocalSessionsToFirebase(localSessions: ChatSession[], userId: string) {
  if (!userId || localSessions.length === 0) return;

  try {
    let batch = writeBatch(db);
    let operationCount = 0;

    for (const session of localSessions) {
      if (operationCount > 400) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }

      const sessionRef = doc(db, 'users', userId, 'sessions', session.id);
      const sessionSnap = await getDoc(sessionRef);
      
      let existingMessageIds = new Set<string>();
      if (sessionSnap.exists()) {
         const msgsQuery = query(collection(db, 'users', userId, 'sessions', session.id, 'messages'));
         const msgsSnap = await getDocs(msgsQuery);
         msgsSnap.docs.forEach(d => existingMessageIds.add(d.id));
      }

      const baseData: any = {
        title: session.title,
        updatedAt: serverTimestamp(),
        notes: session.notes || null,
        tone: session.tone || null,
        writingConfig: session.writingConfig || null,
        memoryEntries: session.memoryEntries || null,
      };

      if (!sessionSnap.exists()) {
         Object.assign(baseData, {
            id: session.id,
            userId: userId,
            createdAt: serverTimestamp()
         });
         // Ensure no undefined values
         Object.keys(baseData).forEach(key => baseData[key] === undefined && delete baseData[key]);
         batch.set(sessionRef, baseData);
      } else {
         // Ensure no undefined values
         Object.keys(baseData).forEach(key => baseData[key] === undefined && delete baseData[key]);
         batch.update(sessionRef, baseData);
      }
      operationCount++;

      // Also sync messages
      if (session.messages && session.messages.length > 0) {
         let msgIndex = 0;
         for (const msg of session.messages) {
            msgIndex++;
            if (operationCount > 450) {
               await batch.commit();
               batch = writeBatch(db);
               operationCount = 0;
            }
            
            const msgRef = doc(db, 'users', userId, 'sessions', session.id, 'messages', msg.id);
            
            const msgBaseData: any = {
               text: msg.text || '',
               isPinned: msg.isPinned || false,
               order: msgIndex,
            };
            if (msg.imageUrl) msgBaseData.imageUrl = msg.imageUrl;
            if (msg.modelType) msgBaseData.modelType = msg.modelType;

            const msgExists = existingMessageIds.has(msg.id);

            if (!msgExists) {
               Object.assign(msgBaseData, {
                 id: msg.id,
                 role: msg.role,
                 modelType: msg.modelType || null,
                 imageUrl: msg.imageUrl || null,
                 createdAt: serverTimestamp()
               });
               Object.keys(msgBaseData).forEach(key => msgBaseData[key] === undefined && delete msgBaseData[key]);
               batch.set(msgRef, msgBaseData);
            } else {
               Object.keys(msgBaseData).forEach(key => msgBaseData[key] === undefined && delete msgBaseData[key]);
               batch.update(msgRef, msgBaseData);
            }
            
            operationCount++;
         }
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, 'write', 'users');
  }
}

export async function fetchSessionsFromFirestore(userId: string): Promise<ChatSession[]> {
  try {
    const sessionsQuery = query(collection(db, 'users', userId, 'sessions'), where("userId", "==", userId));
    const snapshot = await getDocs(sessionsQuery);
    
    const sessions: ChatSession[] = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      
      // Also fetch messages WITHOUT orderBy, because some might have identical timestamps from batching
      const msgsQuery = query(collection(db, 'users', userId, 'sessions', data.id, 'messages'));
      const msgsSnap = await getDocs(msgsQuery);
      const fetchedMessages: any[] = msgsSnap.docs.map(msgDoc => msgDoc.data());
      
      // Sort in memory to guarantee stability and prevent missing messages
      fetchedMessages.sort((a, b) => {
         const timeA = a.createdAt ? (typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : 0) : 0;
         const timeB = b.createdAt ? (typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : 0) : 0;
         if (timeA !== timeB) return timeA - timeB;
         const orderA = typeof a.order === 'number' ? a.order : 0;
         const orderB = typeof b.order === 'number' ? b.order : 0;
         return orderA - orderB;
      });

      const messages: Message[] = fetchedMessages.map(mData => {
         return {
            id: mData.id,
            role: mData.role,
            text: mData.text,
            modelType: mData.modelType,
            isPinned: mData.isPinned,
            imageUrl: mData.imageUrl,
         } as Message;
      });

      // Sort messages by createdAt if you had it, but we don't locally have it usually, so maybe no sorting needed.
      // We will sort them by an assumption or we will just use them.
      
      sessions.push({
        id: data.id,
        title: data.title,
        updatedAt: fromFirestoreTimestamp(data.updatedAt),
        notes: data.notes,
        tone: data.tone,
        writingConfig: data.writingConfig,
        memoryEntries: data.memoryEntries,
        messages: messages
      });
    }

    // Sort sessions descending by updatedAt
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    return sessions;

  } catch (error) {
    handleFirestoreError(error, 'get', 'users/sessions');
    return [];
  }
}
