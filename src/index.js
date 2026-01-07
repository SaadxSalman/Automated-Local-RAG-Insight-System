import express from 'express';
import weaviate from 'weaviate-client';
import { HfInference } from '@huggingface/inference';
import 'dotenv/config';

const app = express();
app.use(express.json());
app.use(express.static('public'));

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
const client = await weaviate.connectToWeaviateCloud(process.env.WEAVIATE_URL, {
  authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY),
});

app.post('/ask', async (req, res) => {
  const { question } = req.body;

  try {
    // 1. Vectorize Question
    const questionVector = await hf.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: question,
    });

    // 2. Search Weaviate
    const collection = client.collections.get('Document');
    const result = await collection.query.nearVector(questionVector, {
      limit: 3,
      returnProperties: ['content', 'source'],
    });

    const context = result.objects.map(obj => obj.properties.content).join('\n---\n');

    // 3. Generate Answer using HF LLM (Mistral/Llama)
    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.2',
      inputs: `Context: ${context}\n\nQuestion: ${question}\n\nAnswer:`,
      parameters: { max_new_tokens: 500 },
    });

    res.json({
      answer: response.generated_text.split('Answer:')[1] || response.generated_text,
      sources: [...new Set(result.objects.map(obj => obj.properties.source))]
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log('ALRIS running on http://localhost:3000'));