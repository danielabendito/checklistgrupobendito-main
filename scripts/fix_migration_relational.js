import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('d:/Antigravity/checklistgrupobendito-main/.env', 'utf8');
const SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/^"|"$/g, '');
const SUPABASE_SERVICE_KEY = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/^"|"$/g, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const dataDir = 'd:/Antigravity/checklistgrupobendito-main/dados_migracao';

async function readCsv(filePath) {
  return new Promise((resolve) => {
    const results = [];
    if (!fs.existsSync(filePath)) return resolve([]);
    fs.createReadStream(filePath).pipe(csv({ separator: ';' }))
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results));
  });
}

function findLatest(tableName) {
  const files = fs.readdirSync(dataDir).filter(f => f.startsWith(`${tableName}-export-`) && f.endsWith('.csv'));
  return files.length ? path.join(dataDir, files.sort().reverse()[0]) : null;
}

async function fixMigration() {
  console.log('--- Finalizing Migration (V4 - Relational Fix) ---');

  // 1. Load Mappings
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const profilesCsv = await readCsv(findLatest('profiles'));
  const uuidMap = {};
  profilesCsv.forEach(p => {
    const au = authUsers.users.find(u => u.email === p.email);
    if (au) uuidMap[p.id] = au.id;
  });

  const { data: dbRoles } = await supabase.from('roles').select('id, name, store_id');
  const { data: dbStores } = await supabase.from('stores').select('id');
  const validStoreIds = new Set(dbStores.map(s => s.id));

  // 2. Fix Checklist Types & Items (Prerequisite for Responses)
  const typesCsv = await readCsv(findLatest('checklist_types'));
  const validTypes = typesCsv.filter(t => validStoreIds.has(t.store_id)).map(t => {
    const nt = { ...t };
    for (const k in nt) if (nt[k] === '') nt[k] = null;
    return nt;
  });
  await supabase.from('checklist_types').upsert(validTypes, { onConflict: 'id' });
  console.log(`Synced ${validTypes.length} checklist types.`);

  const itemsCsv = await readCsv(findLatest('checklist_items'));
  const typeIds = new Set(validTypes.map(t => t.id));
  const validItems = itemsCsv.filter(i => typeIds.has(i.checklist_type_id)).map(i => {
    const ni = { ...i };
    for (const k in ni) if (ni[k] === '') ni[k] = null;
    return ni;
  });
  await supabase.from('checklist_items').upsert(validItems, { onConflict: 'id' });
  console.log(`Synced ${validItems.length} checklist items.`);

  // 3. Fix Responses
  console.log('Syncing checklist responses...');
  const respCsv = await readCsv(findLatest('checklist_responses'));
  const itemIds = new Set(validItems.map(i => i.id));
  const mappedResp = respCsv.filter(r => itemIds.has(r.checklist_item_id)).map(r => {
    const nr = { ...r };
    if (uuidMap[r.user_id]) nr.user_id = uuidMap[r.user_id];
    if (!validStoreIds.has(nr.store_id)) nr.store_id = [...validStoreIds][0]; // Fallback to first store
    for (const k in nr) if (nr[k] === '') nr[k] = null;
    return nr;
  });

  for (let i = 0; i < mappedResp.length; i += 1000) {
    const { error } = await supabase.from('checklist_responses').upsert(mappedResp.slice(i, i + 1000), { onConflict: 'id' });
    if (error) console.error('Error in responses batch:', error.message);
    else process.stdout.write(`\rImported ${i + 1000}/${mappedResp.length}`);
  }

  // 4. Fix User Roles
  console.log('\nSyncing user roles...');
  const rolesCsv = await readCsv(findLatest('user_roles'));
  const mappedUserRoles = [];
  for (const ur of rolesCsv) {
    const newUid = uuidMap[ur.user_id];
    if (!newUid) continue;
    // Find role_id from dbRoles matching name
    const roleMatch = dbRoles.find(r => r.name === ur.role);
    if (roleMatch) {
      mappedUserRoles.push({
        user_id: newUid,
        role: ur.role,
        role_id: roleMatch.id
      });
    }
  }
  await supabase.from('user_roles').upsert(mappedUserRoles, { onConflict: 'user_id, role' });

  console.log('\n--- Migration Finished Successfully ---');
}

fixMigration();
