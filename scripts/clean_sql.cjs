const fs = require('fs');
const path = require('path');

const filePath = 'd:/Antigravity/checklistgrupobendito-main/dados_migracao/full_schema.sql';
let content = fs.readFileSync(filePath, 'utf8');

const newUrl = 'https://mbvufaeaudkeigkktbzo.supabase.co';
const newAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1idnVmYWVhdWRrZWlna2t0YnpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTM0MzQsImV4cCI6MjA5MjYyOTQzNH0.HZ-ufSw-N0nePIQ2p4bpW1kMb3AQdH-LQ5Op03IxBGE';

const oldUrl = 'https://qwetfynfpfjruswdnaps.supabase.co';
const oldAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZXRmeW5mcGZqcnVzd2RuYXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjUyOTUsImV4cCI6MjA3NTAwMTI5NX0.RaE8VDPT3wGS3uPOJR5jsQqh6zS1glMwBncu2l01nB8';

// 1. Replace URLs and Keys
content = content.split(oldUrl).join(newUrl);
content = content.split(oldAnonKey).join(newAnonKey);

// 2. Disable extensions
content = content.split('CREATE EXTENSION IF NOT EXISTS pg_cron').join('-- CREATE EXTENSION IF NOT EXISTS pg_cron');
content = content.split('CREATE EXTENSION IF NOT EXISTS pg_net').join('-- CREATE EXTENSION IF NOT EXISTS pg_net');

// 3. Comment out problematic lines individually
let lines = content.split('\n');
let newLines = [];

for (let line of lines) {
    let trimmed = line.trim();
    if (trimmed.includes('cron.schedule') || 
        trimmed.includes('cron.unschedule') || 
        trimmed.includes('update_notification_cron_jobs();')) {
        
        newLines.push('-- ' + line);
    } else {
        newLines.push(line);
    }
}
content = newLines.join('\n');

// 4. Force fix AS $ to AS $$ using split/join to avoid regex escaping
content = content.split('AS $').join('AS $$');
content = content.split('AS $$$').join('AS $$'); // Fix any accidental triple dollars

fs.writeFileSync(filePath, content, 'utf8');
console.log('SQL file Reset & Cleaned with Version 10 (True Final).');
