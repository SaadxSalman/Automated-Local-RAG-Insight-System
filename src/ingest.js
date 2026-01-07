import express from 'express';
import weaviate from 'weaviate-client';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const client = await weaviate.connectToWeaviateCloud(
  process.env.WEAVIATE_URL,
  {
    authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY),
    headers: { 'X-HuggingFace-Api-Key': process.env.HUGGINGFACE_API_KEY }
  }
);

app.post('/search', async (req, res) => {
  const { query } = req.body;
  const collection = client.collections.get('Document');

  try {
    // Generate an answer based on retrieved context
    const result = await collection.generate.nearText(query, {
      singlePrompt: `Answer the following question based on this context: {content}. Question: ${query}`,
    }, { limit: 3 });

    const response = {
      answer: result.objects[0]?.generated || "No answer could be generated.",
      sources: result.objects.map(obj => ({
        text: obj.properties.content.substring(0, 200) + '...',
        file: obj.properties.fileName
      }))
    };

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ALRIS Engine running on port ${PORT}`));