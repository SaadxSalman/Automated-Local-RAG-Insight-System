import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import { setupCollection } from './weaviateClient.js';

async function ingest() {
  const collection = await setupCollection();
  const dataDir = path.join(process.cwd(), 'data');
  
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  const files = fs.readdirSync(dataDir);

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    let text = '';

    console.log(`🔍 Processing: ${file}`);

    if (file.endsWith('.pdf')) {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      text = data.text.replace(/\s+/g, ' '); // Clean extra whitespace
    } else {
      text = fs.readFileSync(filePath, 'utf8');
    }

    if (!text || text.length < 20) {
      console.error(`⚠️ Warning: No text extracted from ${file}. Check if it's an image-based PDF.`);
      continue;
    }

    // Show a small preview to verify content
    console.log(`📄 Content Preview: "${text.substring(0, 100)}..."`);

    // Recursive-style chunking (2000 chars with 200 char overlap)
    const chunkSize = 2000;
    const overlap = 200;
    let chunks = [];
    
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      chunks.push(text.substring(i, i + chunkSize));
    }

    for (const chunk of chunks) {
      await collection.data.insert({
        properties: { content: chunk, fileName: file }
      });
    }
    console.log(`✅ Indexed ${chunks.length} chunks for ${file}\n`);
  }
}

ingest().catch(console.error);