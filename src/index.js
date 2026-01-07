import express from 'express';
import cors from 'cors';
import client from './weaviateClient.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.post('/search', async (req, res) => {
  const { query } = req.body;

  try {
    const result = await client.graphql
      .get()
      .withClassName('Document')
      .withFields('content fileName fileType')
      .withNearText({ concepts: [query] })
      .withLimit(3)
      .do();

    res.json(result.data.Get.Document);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ALRIS Server running on http://localhost:${PORT}`));