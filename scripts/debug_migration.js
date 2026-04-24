import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('d:/Antigravity/checklistgrupobendito-main/.env', 'utf8');
const SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/^"|"$/g, '');
const SUPABASE_SERVICE_KEY = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/^"|"$/g, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function debug() {
  console.log('--- Debugging Auth and Profiles ---');
  
  // Check auth users
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error('Error listing auth users:', authError.message);
  } else {
    console.log(`Total Auth Users: ${authData.users.length}`);
    const daniela = authData.users.find(u => u.email === 'daniela.bendito@gmail.com');
    if (daniela) {
      console.log('Found Daniela in Auth:', daniela.id);
    } else {
      console.log('Daniela NOT found in Auth.');
      console.log('First 5 users in Auth:', authData.users.slice(0, 5).map(u => u.email));
    }
  }

  // Check profiles table
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'daniela.bendito@gmail.com');
    
  if (profileError) {
    console.error('Error checking profiles:', profileError.message);
  } else {
    console.log('Daniela in Profiles table:', profileData);
  }
}

debug();
