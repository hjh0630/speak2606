/**
 * seed-vocabulary.ts
 *
 * Imports vocabulary from /workspace/content/vocabulary.json (or CONTENT_DIR) into the
 * `vocabulary_progress` table, so we can track per-term correct/wrong counts.
 *
 * Safe to run multiple times — the table uses `term` as UNIQUE and we use UPSERT semantics.
 *
 * Usage:  npm run seed
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { config } from '../src/config';
import { getDb, closeDb } from '../src/db';
import { getVocabulary } from '../src/services/content';
import { createLogger } from '../src/utils/logger';
import type { VocabularyEntry } from '../src/types';

const log = createLogger('seed-vocab');

function readExternal(): VocabularyEntry[] {
  const filePath = path.join(config.contentDir, 'vocabulary.json');
  if (!fs.existsSync(filePath)) {
    log.warn(`vocabulary.json not found at ${filePath}; falling back to in-memory defaults (may be empty).`);
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as unknown;
    if (Array.isArray(data)) return data as VocabularyEntry[];
    log.warn('vocabulary.json is not an array; skipping external import.');
    return [];
  } catch (err) {
    log.error(`Failed to parse vocabulary.json: ${(err as Error).message}`);
    return [];
  }
}

function main(): void {
  const external = readExternal();
  const fallback = getVocabulary();
  const list = external.length > 0 ? external : fallback;
  if (list.length === 0) {
    log.warn('No vocabulary entries to import. Create /workspace/content/vocabulary.json first.');
    return;
  }
  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO vocabulary_progress (term, correct_count, wrong_count, last_seen)
     VALUES (?, 0, 0, ?)
     ON CONFLICT(term) DO NOTHING`,
  );
  const tx = db.transaction((entries: VocabularyEntry[]) => {
    const now = Date.now();
    let inserted = 0;
    for (const e of entries) {
      if (!e.term || typeof e.term !== 'string') continue;
      const info = upsert.run(e.term.trim(), now);
      if (info.changes > 0) inserted += 1;
    }
    return inserted;
  });

  const inserted = tx(list);
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM vocabulary_progress`).get() as { c: number }).c;
  log.info(`Inserted ${inserted} new vocabulary rows (table now has ${total} tracked terms).`);

  closeDb();
}

try {
  main();
} catch (err) {
  log.error(`seed-vocabulary failed: ${(err as Error).message}`);
  process.exitCode = 1;
}
