import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Routes
  app.post("/api/gemini/generate-image", async (req, res) => {
    try {
      res.status(403).json({ error: "La generación de imágenes está desactivada (requiere gemini-2.5-flash-image)." });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/gemini/extract-memory", async (req, res) => {
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY is not defined" });
      
      const { recentMessages } = req.body;
      const currentAi = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });

      const prompt = `Analiza la siguiente conversación reciente y extrae información CLAVE sobre el lore, la trama (plot), los personajes (character) y el mundo (world) o eventos importantes (event).
Devuelve un array JSON estricto SIN formato Markdown, que contenga objetos con la siguiente estructura: { "category": "character" | "plot" | "world" | "event", "name": "Nombre corto", "content": "Detalles relevantes" }.
Extrae SOLO información que sea crucial recordar a largo plazo. Si no hay nada importante que extraer, devuelve [].

Conversación:
${recentMessages}`;

      const response = await currentAi.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.1,
        }
      });

      const text = response.text || "[]";
      // Nettoyer posibles backticks de markdown
      const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const extracted = JSON.parse(cleanedText);
      
      let results = [];
      if (Array.isArray(extracted)) {
        results = extracted.map((e: any) => ({
          id: Math.random().toString(36).substring(2) + Date.now().toString(36),
          category: e.category || 'world',
          name: e.name || 'Desconocido',
          content: e.content || ''
        }));
      }
      res.json({ entries: results });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/gemini/generate-stream", async (req, res) => {
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY is not defined" });
      
      const { contents, instruction, modelType } = req.body;
      const currentAi = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });

      const responseStream = await currentAi.models.generateContentStream({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: instruction,
          temperature: modelType === 'prime' ? 0.7 : 0.9,
        }
      });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: any) {
      console.error(err);
      const is403 = (err.status === 403 || err.message?.includes('403') || err.message?.includes('PERMISSION_DENIED'));
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message, status: is403 ? 403 : 500 })}\n\n`);
      res.end();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
