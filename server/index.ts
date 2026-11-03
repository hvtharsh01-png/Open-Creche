import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import app from './app.js';

// Local / self-hosted entry. On Vercel the same app runs as a serverless function (see api/index.ts).

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => (req.path.startsWith('/api') ? next() : res.sendFile(path.join(dist, 'index.html'))));
}

const PORT = Number(process.env.PORT) || 4001;
app.listen(PORT, () => console.log(`Open Creche Network API  ->  http://localhost:${PORT}/api/stats`));
