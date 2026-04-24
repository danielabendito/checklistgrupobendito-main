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

async function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    if (!fs.existsSync(filePath)) return resolve([]);
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
  matchingFiles.sort().reverse();
  return path.join(dataDir, matchingFiles[0]);
}

async function migrate() {
  console.log('--- Starting Data Migration (V3 - Final) ---');
  
  // 1. Organizations & Stores
  for (const tableName of ['organizations', 'stores']) {
    const file = findLatestExport(tableName);
    if (!file) continue;
    const records = await readCsv(file);
    const clean = records.map(r => {
      const nr = { ...r };
      for (const k in nr) {
        if (nr[k] === '') nr[k] = null;
        if (typeof nr[k] === 'string' && nr[k].startsWith('[') && nr[k].endsWith(']')) {
          try { nr[k] = JSON.parse(nr[k]); } catch(e) {}
        }
      }
      return nr;
    });
    console.log(`Upserting ${clean.length} to ${tableName}...`);
    const { error } = await supabase.from(tableName).upsert(clean, { onConflict: 'id' });
    if (error) { console.error(`Error ${tableName}:`, error.message); return; }
  }

  // 2. Setup mapping and users
  const profilesFile = findLatestExport('profiles');
  const profilesData = await readCsv(profilesFile);
  console.log(`Loaded ${profilesData.length} profiles from CSV.`);
  
  const uuidMap = {};
  const { data: storeData } = await supabase.from('stores').select('id').limit(1);
  const defaultStoreId = storeData?.[0]?.id;

  if (!defaultStoreId) { console.error('No stores available!'); return; }

  console.log('Creating bypass invites...');
  const invites = profilesData.map(p => ({
    email: p.email || `${p.id}@fake.bendito.com`,
    store_id: p.store_id || defaultStoreId,
    role: 'atendente',
    used: false
  }));
  
  for (let i = 0; i < invites.length; i += 500) {
    const { error: invErr } = await supabase.from('email_invites').insert(invites.slice(i, i + 500));
    if (invErr && !invErr.message.includes('already exists') && !invErr.message.includes('unique constraint')) {
      console.warn('Invite bypass warning:', invErr.message);
    }
  }
  console.log('Bypass invites ready.');

  console.log('Syncing users with Auth...');
  for (const p of profilesData) {
    const email = p.email || `${p.id}@fake.bendito.com`;
    const { data: ud, error: ue } = await supabase.auth.admin.createUser({
      email, password: DEFAULT_PASSWORD, email_confirm: true
    });

    if (ud?.user) uuidMap[p.id] = ud.user.id;
    else if (ue?.message.includes('already registered')) {
      const { data: ul } = await supabase.auth.admin.listUsers();
      const u = ul.users.find(u => u.email === email);
      if (u) uuidMap[p.id] = u.id;
    } else {
      console.error(`Auth error for ${email}:`, ue?.message);
    }
  }

  console.log(`Mapped ${Object.keys(uuidMap).length} users.`);

  // 3. Profiles
  const mappedProfiles = profilesData.map(p => {
    const nr = { ...p };
    if (uuidMap[p.id]) nr.id = uuidMap[p.id];
    for (const k in nr) if (nr[k] === '') nr[k] = null;
    return nr;
  });
  await supabase.from('profiles').upsert(mappedProfiles, { onConflict: 'id' });

  // 4. Remaining data
  const tables = ['user_roles', 'checklist_types', 'checklist_items', 'checklist_responses', 'inspection_standards', 'inspection_reports', 'inspection_report_items', 'notifications'];
  const userCols = ['id', 'user_id', 'owner_id', 'invited_by', 'executed_by'];

  for (const table of tables) {
    const file = findLatestExport(table);
    if (!file) continue;
    const records = await readCsv(file);
    const mapped = records.map(r => {
      const nr = { ...r };
      for (const col of userCols) if (nr[col] && uuidMap[nr[col]]) nr[col] = uuidMap[nr[col]];
      for (const k in nr) {
        if (nr[k] === '') nr[k] = null;
        if (typeof nr[k] === 'string' && nr[k].startsWith('[') && nr[k].endsWith(']')) {
          try { nr[k] = JSON.parse(nr[k]); } catch(e) {}
        }
      }
      return nr;
    });

    for (let i = 0; i < mapped.length; i += 500) {
      let onConflict = 'id';
      if (table === 'user_roles') onConflict = 'user_id, role';
      const { error } = await supabase.from(table).upsert(mapped.slice(i, i + 500), { onConflict });
      if (error) console.error(`Error in ${table}:`, error.message);
    }
    console.log(`Finished ${table} (${mapped.length} rows).`);
  }
  console.log('--- Migration Done ---');
}

migrate();
