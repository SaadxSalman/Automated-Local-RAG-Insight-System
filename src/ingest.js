import client from './weaviateClient.js';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import pdf from 'pdf-parse';

async function setupSchema() {
  const schemaConfig = {
    class: 'Document',
    vectorizer: 'text2vec-huggingface',
    moduleConfig: {
      'text2vec-huggingface': { model: 'sentence-transformers/all-MiniLM-L6-v2', type: 'text' }
    },
    properties: [
      { name: 'content', dataType: ['text'] },
      { name: 'fileName', dataType: ['string'] },
      { name: 'fileType', dataType: ['string'] }
    ],
  };

  const schemaRes = await client.schema.getter().do();
  const exists = schemaRes.classes.find((c) => c.class === 'Document');
  
  if (!exists) {
    await client.schema.classCreator().withClass(schemaConfig).do();
    console.log('Schema created successfully.');
  }
}

async function ingest() {
  await setupSchema();
  const files = await glob('data/**/*.{pdf,md,txt}');

  for (const filePath of files) {
    console.log(`Processing: ${filePath}`);
    let content = '';
    const ext = path.extname(filePath);

    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      content = data.text;
    } else {
      content = fs.readFileSync(filePath, 'utf-8');
    }

    // Basic Chunking (every 1000 chars)
    const chunks = content.match(/[\s\S]{1,1000}/g) || [];
    
    for (const chunk of chunks) {
      await client.data.creator()
        .withClassName('Document')
        .withProperties({
          content: chunk,
          fileName: path.basename(filePath),
          fileType: ext
        }).do();
    }
  }
  console.log('Ingestion Complete!');
}

ingest();