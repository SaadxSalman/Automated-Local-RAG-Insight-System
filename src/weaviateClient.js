import weaviate from 'weaviate-client';
import { HfInference } from "@huggingface/inference"; // Use HfInference instead of InferenceClient
import dotenv from 'dotenv';

dotenv.config();

// The class is actually named HfInference in the library
export const hf = new HfInference(process.env.HUGGING_FACE_TOKEN);

// Initialize Weaviate Client
export const client = await weaviate.connectToWeaviateCloud(
    process.env.WEAVIATE_URL, 
    { 
        authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY) 
    }
);

// Embedding Logic using Snowflake Arctic M v1.5
export async function getEmbeddings(text) {
    try {
        const response = await hf.featureExtraction({
            model: "Snowflake/snowflake-arctic-embed-m-v1.5",
            inputs: text,
        });
        return response;
    } catch (error) {
        console.error("Embedding Error:", error.message);
        throw error;
    }
}