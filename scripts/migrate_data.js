import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';

// Parse .env file
const envFile = fs.readFileSync('d:/Antigravity/checklistgrupobendito-main/.env', 'utf8');
const SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/^"|"$/g, '');
const SUPABASE_SERVICE_KEY = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/^"|"$/g, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const dataDir = 'd:/Antigravity/checklistgrupobendito-main/dados_migracao';
const DEFAULT_PASSWORD = 'bendito';

// Columns that might contain user UUIDs that need mapping
const userUuidColumns = ['id', 'user_id', 'owner_id', 'invited_by', 'executed_by'];

// We must respect foreign key dependency order
const tableOrder = [
  'organizations',
  'stores',
  // profiles are handled separately first
  'roles',
  'user_roles',
  'checklist_types',
  'checklist_items',
  'admin_settings',
  'inspection_standards',
  'checklist_responses',
  'inspection_reports',
  'inspection_report_items',
  'audit_logs',
  'email_invites',
  'checklist_notifications',
  'notifications'
];

async function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv({ separator: ';' }))
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function findLatestExport(tableName) {
  const files = fs.readdirSync(dataDir);
  const matchingFiles = files.filter(f => f.startsWith(`${tableName}-export-`) && f.endsWith('.csv'));
  if (matchingFiles.length === 0) return null;
  // Sort descending by name to get the latest
  matchingFiles.sort().reverse();
  return path.join(dataDir, matchingFiles[0]);
}

async function migrate() {
  console.log('--- Starting Data Migration ---');
  
  const profilesFile = findLatestExport('profiles');
  if (!profilesFile) {
    console.error('profiles CSV not found!');
    return;
  }

  console.log('Reading profiles to create auth users...');
  const profilesData = await readCsv(profilesFile);
  const uuidMap = {}; // Maps old user_id to new auth.users id

  for (const profile of profilesData) {
    const oldId = profile.id;
    let email = profile.email;
    
    if (!email) {
       console.log(`Profile ${oldId} has no email, creating fake email.`);
       email = `${oldId}@fake.grupobendito.com`;
    }

    try {
      // Create user in auth.users
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { nome: profile.nome, role: profile.role }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
            // Fetch the user to get their new ID
            const { data: existingUsers } = await supabase.auth.admin.listUsers();
            const existingUser = existingUsers.users.find(u => u.email === email);
            if (existingUser) {
                uuidMap[oldId] = existingUser.id;
                console.log(`User ${email} already existed, mapped ${oldId} -> ${existingUser.id}`);
            }
        } else {
            console.error(`Error creating user ${email}:`, authError.message);
        }
      } else if (authData.user) {
        uuidMap[oldId] = authData.user.id;
        console.log(`Created user ${email}, mapped ${oldId} -> ${authData.user.id}`);
      }
    } catch (e) {
      console.error(`Exception creating user ${email}:`, e);
    }
  }

  console.log(`\nSuccessfully mapped ${Object.keys(uuidMap).length} users.`);

  // Now process the tables in order
  // We add 'profiles' to the front so it's upserted first to populate names/etc correctly after trigger fires
  const tablesToProcess = ['profiles', ...tableOrder];

  for (const tableName of tablesToProcess) {
    const file = findLatestExport(tableName);
    if (!file) {
      console.log(`Skipping ${tableName} - no CSV found.`);
      continue;
    }

    console.log(`\nProcessing ${tableName}...`);
    let records = await readCsv(file);
    console.log(`Found ${records.length} records.`);

    // Map UUIDs and prepare batch
    const mappedRecords = [];
    for (const record of records) {
      const newRecord = { ...record };
      
      // Map user UUIDs
      for (const col of userUuidColumns) {
        if (newRecord[col] && uuidMap[newRecord[col]]) {
          newRecord[col] = uuidMap[newRecord[col]];
        }
      }

      // Convert empty strings to null for UUIDs or timestamps to prevent validation errors
      for (const key of Object.keys(newRecord)) {
         if (newRecord[key] === '') {
             newRecord[key] = null;
         }
      }

      mappedRecords.push(newRecord);
    }

    // Upsert in batches of 500
    const batchSize = 500;
    let successCount = 0;
    
    for (let i = 0; i < mappedRecords.length; i += batchSize) {
      const batch = mappedRecords.slice(i, i + batchSize);
      
      // Determine onConflict column(s) for upsert
      let onConflict = 'id';
      if (tableName === 'user_roles') onConflict = 'user_id, role';
      
      const { data, error } = await supabase.from(tableName).upsert(batch, { onConflict });
      
      if (error) {
        console.error(`Error upserting batch in ${tableName}:`, error.message);
        console.error('First record of failing batch:', batch[0]);
        // Don't break, keep trying other batches
      } else {
        successCount += batch.length;
        process.stdout.write(`\rInserted ${successCount}/${mappedRecords.length}`);
      }
    }
    console.log(`\nFinished ${tableName}.`);
  }

  console.log('\n--- Migration Complete ---');
}

migrate();
