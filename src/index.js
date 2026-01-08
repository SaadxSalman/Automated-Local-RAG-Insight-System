import express from 'express';
import cors from 'cors';
import { client, hf } from './weaviateClient.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. Health Check Route (to avoid "Cannot GET /" errors)
app.get('/', (req, res) => {
  res.send('🚀 ALRIS Backend Engine is Online');
});

app.post('/ask', async (req, res) => {
  // Ensure we handle both 'query' and 'question' naming from frontend
  const query = req.body.query || req.body.question;

  if (!query) {
    return res.status(400).json({ error: "No query provided" });
  }

  try {
    const collection = client.collections.get('ALRIS_Documents');

    // 1. Retrieval (Semantic Search)
    const result = await collection.query.nearText(query, { 
      limit: 3 
    });

    if (result.objects.length === 0) {
      return res.json({ 
        answer: "I couldn't find any relevant information in your documents.",
        sources: [] 
      });
    }

    // 2. Combine results and TRUNCATE to stay within model token limits
    // BART-Large-CNN fails if the input is too long. 
    // We truncate the context to ~3000 characters to be safe.
    const context = result.objects
      .map(o => o.properties.content)
      .join("\n\n")
      .substring(0, 3000);

    // 3. Generation (Summarization/RAG)
    const summary = await hf.summarization({
      model: "facebook/bart-large-cnn",
      inputs: `Context: ${context}\n\nQuestion: ${query}\n\nAnswer:`,
      parameters: {
        max_length: 150,
        min_length: 40,
        do_sample: false
      }
    });

    // 4. Send Response
    res.json({ 
      answer: summary.summary_text, 
      sources: [...new Set(result.objects.map(o => o.properties.fileName))] // Unique filenames
    });

  } catch (error) {
    console.error("❌ Backend Error:", error);
    res.status(500).json({ 
      error: "Error processing your request.",
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`🚀 ALRIS Server running at http://localhost:${PORT}`);
});