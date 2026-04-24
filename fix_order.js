import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
  const envPath = path.resolve(__dirname, '.env');
  const envLocalPath = path.resolve(__dirname, '.env.local');
  
  const parseEnv = (filePath) => {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          if (!process.env[key]) process.env[key] = value;
        }
      });
    }
  }
  
  parseEnv(envPath);
  parseEnv(envLocalPath);
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env files");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching all checklists...");
  const { data: checklists, error: chkError } = await supabase.from('checklist_types').select('id, nome');
  if (chkError) {
     console.error("Error fetching checklists:", chkError);
     return;
  }
  
  let totalItemsUpdated = 0;
  
  for (const checklist of checklists) {
     console.log(`\nProcessing checklist: ${checklist.nome}`);
     const { data: items, error: itemError } = await supabase
       .from('checklist_items')
       .select('id, ordem, nome')
       .eq('checklist_type_id', checklist.id)
       .order('ordem', { ascending: true })
       .order('created_at', { ascending: true }); // Fallback sorting for duplicates/gaps
       
     if (itemError || !items) {
       console.error(`Error fetching items for ${checklist.nome}:`, itemError);
       continue;
     }
     
     let expectedOrdem = 1;
     for (const item of items) {
       if (item.ordem !== expectedOrdem) {
         console.log(`  [FIX] Item "${item.nome}" -> changing ordem from ${item.ordem} to ${expectedOrdem}`);
         const { error: updateError } = await supabase.from('checklist_items').update({ ordem: expectedOrdem }).eq('id', item.id);
         if (updateError) {
             console.error(`  Failed to update "${item.nome}":`, updateError);
         } else {
             totalItemsUpdated++;
         }
       } else {
           // console.log(`  [OK] Item "${item.nome}" is correctly at ordem ${expectedOrdem}`);
       }
       expectedOrdem++;
     }
  }
  console.log(`\nDone updating all checklists! Fixed ${totalItemsUpdated} items in total.`);
}

run();
