/**
 * Apply apps/api/prisma/turso-init.sql to a Turso database.
 *
 * Usage (from apps/api):
 *   node scripts/init-turso.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

async function main() {
    const apiRoot = path.resolve(__dirname, '..');
    loadEnvFile(path.join(apiRoot, '.env'));

    const url = process.env.TURSO_DATABASE_URL?.trim();
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
    if (!url || !authToken) {
        console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN.');
        console.error('Create a DB at https://turso.tech, then set both values and rerun.');
        process.exit(1);
    }

    const sqlPath = path.join(apiRoot, 'prisma', 'turso-init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.split('\n').every((line) => line.trim().startsWith('--')));

    const client = createClient({ url, authToken });
    console.log(`Applying ${statements.length} statements to Turso...`);

    for (const statement of statements) {
        await client.execute(statement);
    }

    console.log('Turso schema applied successfully.');
}

main().catch((error) => {
    console.error('Failed to init Turso schema:', error);
    process.exit(1);
});
