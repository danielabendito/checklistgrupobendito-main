import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('d:/Antigravity/checklistgrupobendito-main/.env', 'utf8');
const SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/^"|"$/g, '');
const SUPABASE_SERVICE_KEY = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/^"|"$/g, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function check() {
  const { error } = await supabase.from('email_invites').select('id').limit(1);
  if (error) console.error('Table check error:', error.message);
  else console.log('email_invites table exists.');
}
check();
