
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTables() {
  console.log('Inspecting Tables...');
  
  // Try to select from Contractor to see if it works with different casings
  const casings = ['Contractor', 'contractor', 'CONTRACTOR', 'Contractors', 'contractors'];
  
  for (const table of casings) {
      const { data, error } = await supabase.from(table).select('id').limit(1);
      if (!error) {
          console.log(`✅ Table found: "${table}"`);
          return;
      } else {
          console.log(`❌ Table not found as "${table}": ${error.message} (${error.code})`);
      }
  }

  console.log('Trying to query directly via RPC if available or just guessing standard supabase casing.');
}

inspectTables();
