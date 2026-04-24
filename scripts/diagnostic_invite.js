import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('d:/Antigravity/checklistgrupobendito-main/.env', 'utf8');
const SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/^"|"$/g, '');
const SUPABASE_SERVICE_KEY = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/^"|"$/g, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function diagnostic() {
  console.log('--- Diagnostic: Inserting Fake Invite ---');
  
  // Get a store_id
  const { data: stores } = await supabase.from('stores').select('id').limit(1);
  if (!stores || stores.length === 0) {
    console.error('No stores found in DB!');
    return;
  }
  const storeId = stores[0].id;
  console.log('Using Store ID:', storeId);

  const testEmail = 'test_invite@example.com';
  
  const invite = {
    email: testEmail,
    store_id: storeId,
    role: 'admin',
    used: false
  };

  const { data, error } = await supabase.from('email_invites').insert(invite);
  
  if (error && !error.message.includes('already exists') && !error.message.includes('unique constraint')) {
    console.error('FAILED to insert invite:', error.message);
    console.error('Details:', error);
  } else {
    if (error) console.log('Invite already exists (ignoring error).');
    else console.log('SUCCESS: Invite inserted.');
    
    // Now try to create a user with this email
    console.log('Trying to create user...');
    const { data: ud, error: ue } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'testpassword123',
      email_confirm: true
    });
    
    if (ue) {
      console.error('FAILED to create user:', ue.message);
    } else {
      console.log('SUCCESS: User created:', ud.user.id);
    }
  }
}

diagnostic();
