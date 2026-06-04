import { Message, Tone, WritingConfig } from "../types";

const SYSTEM_INSTRUCTION_RAPID = `Eres Helk Rapid, un asistente de escritura ágil y directo. Tu objetivo es proporcionar ideas rápidas, lluvia de ideas (brainstorming), soluciones inmediatas a bloqueos creativos y respuestas concisas. Eres dinámico, vas directo al grano y priorizas la velocidad y la fluidez creativa para que el escritor no pierda el ritmo. Responde en el idioma en el que te hablen, preferiblemente español.`;

const SYSTEM_INSTRUCTION_PRIME = `Eres Helk PRIME, un asistente de escritura de IA de élite y analista narrativo experto. Tu objetivo es ofrecer análisis profundos, desarrollo complejo de personajes, construcción de mundos (worldbuilding) detallada y prosa de la más alta calidad. Tienes una memoria impecable para el 'lore' y eres experto en detectar agujeros de guion sutiles, inconsistencias temáticas o de continuidad. Tus respuestas son exhaustivas, reflexivas, estructuradas y con un tono profesional y literario. Responde en el idioma en el que te hablen, preferiblemente español.`;

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  'balanced': 'Mantén un tono equilibrado y natural.',
  'descriptive': 'Usa un tono altamente descriptivo, rico en detalles sensoriales, metáforas y adjetivos evocadores.',
  'direct': 'Usa un tono directo, conciso y al grano. Evita la floritura innecesaria.',
  'epic': 'Usa un tono épico, grandilocuente y heroico, ideal para fantasía alta o momentos climáticos.',
  'dark': 'Usa un tono oscuro, sombrío, misterioso o de suspense. Ideal para terror, thriller o fantasía oscura.',
  'dramatic': 'Usa un tono dramático, enfocado en la emoción intensa, el conflicto interno y la tensión interpersonal.'
};

export async function generateCoverImage(prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "16:9"): Promise<string> {
  const response = await fetch('/api/gemini/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspectRatio })
  });

  const data = await response.json();
  if (!response.ok) {
    if (data.error && data.error.includes('PERMISSION_DENIED')) {
      if (typeof window !== 'undefined' && 'aistudio' in window) {
        const aistudio = (window as any).aistudio;
        console.warn("API Key lacks permissions. Prompting for new key...");
        await aistudio.openSelectKey();
        return generateCoverImage(prompt, aspectRatio);
      }
    }
    throw new Error(data.error || 'Failed to generate image');
  }

  return data.image;
}

export async function extractMemoryEntries(messages: Message[]): Promise<import('../types').MemoryEntry[]> {
  const tryExtract = async () => {
    // Limit to the last ~10 messages to avoid huge prompts for extraction
    const recentMessages = messages.slice(-10).map(m => `${m.role === 'user' ? 'USER' : 'HELK'}: ${m.text}`).join('\n');

    const response = await fetch('/api/gemini/extract-memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recentMessages })
    });

    const data = await response.json();
    if (!response.ok) {
      if (data.error && data.error.includes('PERMISSION_DENIED')) {
        if (typeof window !== 'undefined' && 'aistudio' in window) {
          const aistudio = (window as any).aistudio;
          console.warn("API Key lacks permissions. Prompting for new key...");
          await aistudio.openSelectKey();
          return tryExtract();
        }
      }
      throw new Error(data.error || 'Failed to extract memory');
    }

    return data.entries || [];
  };

  try {
    return await tryExtract();
  } catch (error: any) {
    console.error("Failed to extract memory", error);
    return [];
  }
}

import { STYLES, PERSPECTIVES } from '../components/WritingSetupModal';

export async function* generateResponseStream(messages: Message[], newMessage: string, notes?: string, memoryEntries: import('../types').MemoryEntry[] = [], modelType: 'rapid' | 'prime' = 'rapid', tone: Tone = 'balanced', writingConfig?: WritingConfig): AsyncGenerator<string, void, unknown> {
  // Filter out error messages
  const validMessages = messages.filter(msg => 
    msg.text && !msg.text.includes('Lo siento, hubo un error')
  );

  const contents: any[] = [];

  for (const msg of validMessages) {
    if (contents.length > 0 && contents[contents.length - 1].role === msg.role) {
      contents[contents.length - 1].parts[0].text += '\n\n' + msg.text;
    } else {
      contents.push({
        role: msg.role,
        parts: [{ text: msg.text }]
      });
    }
  }

  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    contents[contents.length - 1].parts[0].text += '\n\n' + newMessage;
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: newMessage }]
    });
  }

  if (contents.length > 0 && contents[0].role === 'model') {
    contents.unshift({
      role: 'user',
      parts: [{ text: 'Hola' }]
    });
  }

  let instruction = modelType === 'prime' ? SYSTEM_INSTRUCTION_PRIME : SYSTEM_INSTRUCTION_RAPID;
  
  if (writingConfig) {
    const styleObj = STYLES.find(s => s.id === writingConfig.style);
    const styleDesc = styleObj ? `${styleObj.name} (${styleObj.desc} Ejemplos: ${styleObj.examples})` : writingConfig.style;
    const perspectiveDesc = PERSPECTIVES.find(p => p.id === writingConfig.perspective)?.name || writingConfig.perspective;

    instruction += `\n\n=== MODO ESCRITURA ACTIVADO ===\nEstás actuando como un ghostwriter o co-autor de una historia.\n\nEl usuario te dará instrucciones sobre qué escribir en el próximo capítulo o segmento de la historia. Deberás escribir basándote en:\n- GÉNERO: ${writingConfig.genre}\n- ESTILO: ${styleDesc}\n- PERSPECTIVA NARRATIVA: ${perspectiveDesc}\n\nREGLAS ESTRICTAS:\n1. Aplica el estilo literario seleccionado de la mejor manera posible, imitando a los autores que lo representan si lo conoces.\n2. Escribe de manera fluida y narrativa. No agregues "Aquí tienes el capítulo" o "Hola". Ve directamente al texto literario.\n3. Asegúrate de continuar el flujo con lo que ya está establecido.\n4. Si el usuario te pide un estilo específico en su mensaje, mézclalo con esta configuración de manera natural.\n5. Si el usuario pide ideas de estilos, sugírele y muéstrale ejemplos en el chat en lugar de escribir el capítulo directamente.`;
  }


  if (tone && TONE_INSTRUCTIONS[tone]) {
    instruction += `\n\nTONO DE RESPUESTA REQUERIDO: ${TONE_INSTRUCTIONS[tone]}`;
  }

  if (notes && notes.trim() !== '') {
    instruction += `\n\nNOTAS MANUALES (Prioridad Alta):\n${notes}`;
  }

  if (memoryEntries && memoryEntries.length > 0) {
    instruction += `\n\n=== MEMORIA A LARGO PLAZO / LOREBOOK ===\nLa siguiente es información confirmada sobre la historia, úsala para mantener la coherencia:\n`;
    const chars = memoryEntries.filter(e => e.category === 'character');
    const plots = memoryEntries.filter(e => e.category === 'plot');
    const worlds = memoryEntries.filter(e => e.category === 'world');
    const events = memoryEntries.filter(e => e.category === 'event');
    
    if (chars.length > 0) {
      instruction += `\n[PERSONAJES]\n` + chars.map(e => `- ${e.name}: ${e.content}`).join('\n');
    }
    if (plots.length > 0) {
      instruction += `\n[TRAMA]\n` + plots.map(e => `- ${e.name}: ${e.content}`).join('\n');
    }
    if (worlds.length > 0) {
      instruction += `\n[MUNDO / LORE]\n` + worlds.map(e => `- ${e.name}: ${e.content}`).join('\n');
    }
    if (events.length > 0) {
      instruction += `\n[EVENTOS PASADOS]\n` + events.map(e => `- ${e.name}: ${e.content}`).join('\n');
    }
  }

  const tryGenerateStream = async function* () {
    const response = await fetch('/api/gemini/generate-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, instruction, modelType })
    });

    if (!response.ok || !response.body) {
      let errorMessage = 'Failed to generate stream';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // ignore
      }
      throw new Error(errorMessage);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          if (dataStr === '[DONE]') {
            return;
          }
          try {
            const data = JSON.parse(dataStr);
            if (data.error) {
              if (data.status === 403) {
                throw new Error('PERMISSION_DENIED');
              }
              throw new Error(data.error);
            }
            if (data.text) {
              yield data.text;
            }
          } catch (e: any) {
            if (e.message === 'PERMISSION_DENIED' || dataStr.includes('PERMISSION_DENIED')) {
              throw new Error('PERMISSION_DENIED');
            }
          }
        } else if (line.startsWith('event: error')) {
          // Handling event: error, the next line will be the data
        }
      }
    }
  };

  try {
    yield* tryGenerateStream();
  } catch (error: any) {
    const errStr = (error?.message || '') + JSON.stringify(error);
    if (errStr.includes('PERMISSION_DENIED') || errStr.includes('403')) {
      if (typeof window !== 'undefined' && 'aistudio' in window) {
        const aistudio = (window as any).aistudio;
        console.warn("API Key lacks permissions. Prompting for new key...");
        await aistudio.openSelectKey();
        
        yield* tryGenerateStream();
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }
}
