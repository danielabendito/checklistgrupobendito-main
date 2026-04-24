import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('d:/Antigravity/checklistgrupobendito-main/.env', 'utf8');
const SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/^"|"$/g, '');
const SUPABASE_SERVICE_KEY = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/^"|"$/g, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkDb() {
  const { data: profiles, error: pError } = await supabase.from('profiles').select('id, email, nome').limit(5);
  console.log('Profiles in DB:', profiles);
  if (pError) console.error('Profiles error:', pError);

  const { data: responses, error: rError } = await supabase.from('checklist_responses').select('id, user_id').limit(5);
  console.log('Responses in DB:', responses);
  if (rError) console.error('Responses error:', rError);
}

checkDb();
