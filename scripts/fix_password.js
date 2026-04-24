import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('d:/Antigravity/checklistgrupobendito-main/.env', 'utf8');
const SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/^"|"$/g, '');
const SUPABASE_SERVICE_KEY = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/^"|"$/g, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fix() {
  console.log('Creating user daniela.bendito@gmail.com with password bendito...');
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'daniela.bendito@gmail.com',
    password: 'bendito',
    email_confirm: true
  });
  
  if (error) {
    console.error('Error creating:', error.message);
  } else {
    console.log('Created user:', data.user.id);
  }

  // Try to login immediately
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'daniela.bendito@gmail.com',
    password: 'bendito'
  });
  
  if (loginError) {
    console.error('Login Failed:', loginError.message);
  } else {
    console.log('Login Success!');
  }
}

fix();
