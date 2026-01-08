import weaviate from 'weaviate-client';
import { HfInference } from "@huggingface/inference";
import dotenv from 'dotenv';

dotenv.config();

// Initialize Hugging Face for Summarization
export const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Initialize Weaviate Client
const client = await weaviate.connectToWeaviateCloud(process.env.WEAVIATE_URL, {
  authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY),
});

export async function setupCollection() {
  const collectionName = 'ALRIS_Documents';
  
  // Check if exists
  const exists = await client.collections.exists(collectionName);
  if (exists) return client.collections.get(collectionName);

  // Create Collection with Snowflake Arctic Embeddings
  return await client.collections.create({
    name: collectionName,
    vectorizers: [
      weaviate.configure.vectors.text2VecWeaviate({
        name: 'content_vector',
        sourceProperties: ['content'],
        model: 'Snowflake/snowflake-arctic-embed-l-v2.0', // High-performance model
      }),
    ],
    properties: [
      { name: 'content', dataType: 'text' },
      { name: 'fileName', dataType: 'text' },
    ],
  });
}

export { client };