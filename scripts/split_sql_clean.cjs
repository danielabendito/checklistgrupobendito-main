const fs = require('fs');
const path = require('path');

const migrationsDir = 'd:/Antigravity/checklistgrupobendito-main/supabase/migrations';
const files = fs.readdirSync(migrationsDir).sort();

// Files that are purely cron-related or data migrations that fail on empty DBs
const excludeFiles = [
    // Cron related files
    '20251005202131_9aa6f0d2-f286-43e6-8cee-ec6dacc12077.sql',
    '20251005202145_615d064b-83c0-43a9-9813-fedd1a6d2090.sql',
    '20251005202330_c2c9b985-6034-4c6d-9527-dca46bedabdc.sql',
    '20251008141209_38424dae-d5e5-454d-82d5-dd06c207bf4a.sql',
    '20251016234747_4605cc8c-c498-4537-aa66-7cea72e7ffd7.sql',
    '20251021001755_b893955f-7584-4a8b-94fa-5f566e6d5847.sql',
    '20251021001829_fb7da0d8-ee1d-45bb-902d-db225bdfe595.sql',
    '20251021001949_a45998df-db70-4dc4-b673-c417d4453d9c.sql',
    // Data migrations that fail on empty DBs
    '20251107015420_8b33b8ba-4526-4a5c-9214-8781ea494aeb.sql'
];

let consolidatedSql = '';

for (const file of files) {
    if (file.endsWith('.sql') && !excludeFiles.includes(file)) {
        const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        consolidatedSql += `\n-- ==========================================\n`;
        consolidatedSql += `-- MIGRATION: ${file}\n`;
        consolidatedSql += `-- ==========================================\n`;
        consolidatedSql += content.trim();
        if (!consolidatedSql.endsWith(';')) {
            consolidatedSql += ';';
        }
        consolidatedSql += '\n';
    }
}

const targetPath = 'd:/Antigravity/checklistgrupobendito-main/dados_migracao/full_schema.sql';
fs.writeFileSync(targetPath, consolidatedSql, 'utf8');

console.log('SQL files consolidated (excluding broken cron and data migration files) into one file.');
