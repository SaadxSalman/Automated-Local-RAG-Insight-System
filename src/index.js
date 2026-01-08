import express from 'express';
import cors from 'cors';
import { client, hf } from './weaviateClient.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

app.post('/ask', async (req, res) => {
  const { query } = req.body;
  const collection = client.collections.get('ALRIS_Documents');

  // 1. Retrieval (Semantic Search)
  const result = await collection.query.nearText(query, { limit: 3 });
  
  const context = result.objects.map(o => o.properties.content).join("\n");

  // 2. Generation (Summarization using BART-Large-CNN)
  const summary = await hf.summarization({
    model: "facebook/bart-large-cnn",
    inputs: `Context: ${context}\n\nQuestion: ${query}\n\nAnswer based on context:`,
    provider: "hf-inference",
  });

  res.json({ 
    answer: summary.summary_text,
    sources: result.objects.map(o => o.properties.fileName)
  });
});

app.listen(process.env.PORT, () => {
  console.log(`🚀 ALRIS Server running at http://localhost:${process.env.PORT}`);
});