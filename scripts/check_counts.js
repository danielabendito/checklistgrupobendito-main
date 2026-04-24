import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('d:/Antigravity/checklistgrupobendito-main/.env', 'utf8');
const SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/^"|"$/g, '');
const SUPABASE_SERVICE_KEY = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/^"|"$/g, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkCounts() {
  const tables = ['organizations', 'stores', 'profiles', 'user_roles', 'checklist_types', 'checklist_responses'];
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) console.error(`Error counting ${table}:`, error.message);
    else console.log(`${table}: ${count} rows`);
  }

  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) console.error('Auth Users Error:', authError.message);
  else console.log(`Auth Users: ${authData.users.length}`);
}

checkCounts();
