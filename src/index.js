import express from 'express';
import cors from 'cors';
import { client, hf, getEmbeddings } from './weaviateClient.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

app.post('/ask', async (req, res) => {
    const { question } = req.body;

    if (!question) {
        return res.status(400).json({ error: "Question is required" });
    }

    try {
        // 1. Vectorize the User Question (using Snowflake Arctic via weaviateClient)
        const queryVector = await getEmbeddings(question);

        // 2. Retrieve context from Weaviate using Similarity Search
        const collection = client.collections.get('Document');
        const result = await collection.query.nearVector(queryVector, {
            limit: 4, // Increased limit slightly for better context
            returnProperties: ['content', 'fileName']
        });

        // Construct context string from retrieved chunks
        const context = result.objects.length > 0 
            ? result.objects.map(o => o.properties.content).join("\n---\n")
            : "No relevant local documents found.";

        // 3. Generate Answer using Llama-3.1-8B via Cerebras on Hugging Face
        // Note: You can switch this to "google/gemma-3-4b-it:cerebras" if desired
        const chatCompletion = await hf.chatCompletion({
            model: "meta-llama/Llama-3.1-8B-Instruct:cerebras",
            messages: [
                { 
                    role: "system", 
                    content: "You are ALRIS (Automated-Local-RAG-Insight-System). Use the provided context to answer the user's question accurately. If the context doesn't contain the answer, say you don't know based on local files. Be concise and professional." 
                },
                { 
                    role: "user", 
                    content: `Context:\n${context}\n\nQuestion: ${question}` 
                }
            ],
            max_tokens: 800,
            temperature: 0.7
        });

        // 4. Return the response and the unique source filenames
        const sources = [...new Set(result.objects.map(o => o.properties.fileName))];
        
        res.json({ 
            answer: chatCompletion.choices[0].message.content,
            sources: sources.length > 0 ? sources : ["No local sources used"]
        });

    } catch (error) {
        console.error("Error during RAG process:", error);
        res.status(500).json({ 
            error: "An error occurred while processing your request.",
            details: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`
🚀 ALRIS Engine Online
📍 Server: http://localhost:${PORT}
🧠 Model: Llama-3.1-8B-Instruct (via Cerebras)
📊 Embeddings: Snowflake Arctic M v1.5
    `);
});