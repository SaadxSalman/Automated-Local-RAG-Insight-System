import weaviate from 'weaviate-client';
import { client, getEmbeddings } from './weaviateClient.js';
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';

async function setupSchema() {
    try {
        const collections = await client.collections.listAll();
        const exists = collections.some(c => c.name === 'Document');

        if (!exists) {
            await client.collections.create({
                name: 'Document',
                vectorizers: weaviate.configure.vectorizer.none(),
                properties: [
                    { name: 'fileName', dataType: 'text' },
                    { name: 'content', dataType: 'text' },
                    { name: 'chunkId', dataType: 'int' }
                ]
            });
            console.log("✅ Weaviate Collection 'Document' initialized.");
        } else {
            console.log("ℹ️ Collection 'Document' already exists.");
        }
    } catch (error) {
        console.error("❌ Schema Error:", error.message);
        process.exit(1);
    }
}

async function processFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    try {
        if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            return data.text;
        } else if (ext === '.txt' || ext === '.md') {
            return fs.readFileSync(filePath, 'utf-8');
        }
    } catch (err) {
        console.error(`❌ Could not read ${filePath}:`, err.message);
    }
    return null;
}

async function ingest() {
    await setupSchema();
    
    const docsDir = path.resolve('./data'); // Absolute path for safety
    
    if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir);
        console.log("📁 Created /data folder. Please put .pdf, .md, or .txt files inside.");
        return;
    }

    const files = fs.readdirSync(docsDir).filter(f => !f.startsWith('.'));
    
    if (files.length === 0) {
        console.log("⚠️ The /data folder is empty! Put some files in there first.");
        return;
    }

    console.log(`📂 Found ${files.length} file(s) in /data. Starting ingestion...`);

    const collection = client.collections.get('Document');

    for (const file of files) {
        const filePath = path.join(docsDir, file);
        const rawContent = await processFile(filePath);

        if (rawContent && rawContent.trim().length > 0) {
            console.log(`\n📄 Processing: ${file} (${rawContent.length} chars)`);
            
            const chunkSize = 1000;
            const overlap = 200;
            const chunks = [];
            
            for (let i = 0; i < rawContent.length; i += (chunkSize - overlap)) {
                chunks.push(rawContent.substring(i, i + chunkSize));
            }

            console.log(`🧩 Splitting into ${chunks.length} chunks...`);

            for (const [idx, chunk] of chunks.entries()) {
                try {
                    const vector = await getEmbeddings(chunk);

                    await collection.insert({
                        properties: {
                            fileName: file,
                            content: chunk,
                            chunkId: idx
                        },
                        vectors: vector
                    });
                    process.stdout.write(`.`); 
                } catch (err) {
                    console.error(`\n❌ Error at chunk ${idx}:`, err.message);
                }
            }
            console.log(`\n✅ ${file} indexed.`);
        } else {
            console.log(`⚠️ Skipped ${file}: File is empty or unsupported format.`);
        }
    }
    console.log("\n🚀 ALRIS Ingestion Complete!");
}

ingest().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});