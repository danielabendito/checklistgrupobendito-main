import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('d:/Antigravity/checklistgrupobendito-main/.env', 'utf8');
const SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/^"|"$/g, '');
const SUPABASE_SERVICE_KEY = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/^"|"$/g, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function check() {
  const { data, error } = await supabase.from('user_roles').select('*').limit(1);
  if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  } else {
    // If empty, try to get column names via RPC or just query a known system table
    const { data: cols } = await supabase.rpc('get_table_columns', { t_name: 'user_roles' });
    console.log('Columns (RPC):', cols);
  }
}
check();
