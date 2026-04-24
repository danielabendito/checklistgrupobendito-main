const fs = require('fs');
const path = require('path');

const migrationsDir = 'd:/Antigravity/checklistgrupobendito-main/supabase/migrations';
const files = fs.readdirSync(migrationsDir).sort();

let consolidatedSql = '';

for (const file of files) {
    if (file.endsWith('.sql')) {
        const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        consolidatedSql += `\n-- MIGRATION: ${file}\n`;
        consolidatedSql += content.trim();
        if (!consolidatedSql.endsWith(';')) {
            consolidatedSql += ';';
        }
        consolidatedSql += '\n';
    }
}

// Clean credentials
const newUrl = 'https://mbvufaeaudkeigkktbzo.supabase.co';
const newAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1idnVmYWVhdWRrZWlna2t0YnpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTM0MzQsImV4cCI6MjA5MjYyOTQzNH0.HZ-ufSw-N0nePIQ2p4bpW1kMb3AQdH-LQ5Op03IxBGE';
const oldUrl = 'https://qwetfynfpfjruswdnaps.supabase.co';
const oldAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZXRmeW5mcGZqcnVzd2RuYXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjUyOTUsImV4cCI6MjA3NTAwMTI5NX0.RaE8VDPT3wGS3uPOJR5jsQqh6zS1glMwBncu2l01nB8';

consolidatedSql = consolidatedSql.split(oldUrl).join(newUrl);
consolidatedSql = consolidatedSql.split(oldAnonKey).join(newAnonKey);

// Disable extensions
consolidatedSql = consolidatedSql.split('CREATE EXTENSION IF NOT EXISTS pg_cron').join('-- CREATE EXTENSION IF NOT EXISTS pg_cron');
consolidatedSql = consolidatedSql.split('CREATE EXTENSION IF NOT EXISTS pg_net').join('-- CREATE EXTENSION IF NOT EXISTS pg_net');

// AGGRESSIVE CRON DISABLE: Comment out any block that uses cron.schedule or cron.unschedule
// We use a regex that finds the whole block from SELECT/PERFORM until the matching );
consolidatedSql = consolidatedSql.replace(/(SELECT|PERFORM)\s+cron\.(un)?schedule\([\s\S]*?\);/gi, '/* Disabled Cron Block */');

// Also disable the calls to update_notification_cron_jobs
consolidatedSql = consolidatedSql.replace(/SELECT public\.update_notification_cron_jobs\(\);/gi, '-- Disabled Call');

// Fix AS $$ issue
consolidatedSql = consolidatedSql.split('$$').join('$migration$');

const targetPath = 'd:/Antigravity/checklistgrupobendito-main/dados_migracao/full_schema.sql';
fs.writeFileSync(targetPath, consolidatedSql, 'utf8');

// Split into 3 parts
const lines = consolidatedSql.split('\n');
const partSize = Math.ceil(lines.length / 3);
fs.writeFileSync(targetPath.replace('.sql', '_parte1.sql'), lines.slice(0, partSize).join('\n'), 'utf8');
fs.writeFileSync(targetPath.replace('.sql', '_parte2.sql'), lines.slice(partSize, partSize * 2).join('\n'), 'utf8');
fs.writeFileSync(targetPath.replace('.sql', '_parte3.sql'), lines.slice(partSize * 2).join('\n'), 'utf8');

console.log('SQL files consolidated with aggressive cron disabling and split into 3 parts.');
