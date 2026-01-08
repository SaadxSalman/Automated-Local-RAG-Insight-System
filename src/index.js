import express from 'express';
import cors from 'cors';
import { client, hf } from './weaviateClient.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/ask', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Query is required" });

    const collection = client.collections.get('ALRIS_Documents');

    // 1. Hybrid Retrieval
    // Llama-3.2-3B is efficient enough that we can increase the context limit
    const result = await collection.query.hybrid(query, {
      limit: 6, 
      alpha: 0.5,
    });

    if (result.objects.length === 0) {
      return res.json({ 
        answer: "I couldn't find any relevant data in the local files.", 
        sources: [] 
      });
    }

    // 2. Format Context
    const context = result.objects
      .map(o => `Source: ${o.properties.fileName}\nContent: ${o.properties.content}`)
      .join("\n\n---\n\n");

    // 3. Chat Completion with Llama-3.2-3B-Instruct
    const response = await hf.chatCompletion({
      model: "meta-llama/Llama-3.2-3B-Instruct",
      messages: [
        {
          role: "system",
          content: "You are the ALRIS AI assistant. Provide concise answers based ONLY on the provided context. If the answer is not available, say you don't know."
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion: ${query}`
        }
      ],
      max_tokens: 500,
      temperature: 0.1, // Keep it precise
    });

    // 4. Send Response
    res.json({ 
      answer: response.choices[0].message.content.trim(),
      sources: [...new Set(result.objects.map(o => o.properties.fileName))]
    });

  } catch (error) {
    console.error("ALRIS Engine Error:", error);
    
    // Fallback if the specific provider is down
    res.status(500).json({ 
      error: "The Llama engine encountered an error. This usually happens if the Hugging Face provider is overloaded." 
    });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`🚀 ALRIS Llama-Engine running at http://localhost:${PORT}`);
});