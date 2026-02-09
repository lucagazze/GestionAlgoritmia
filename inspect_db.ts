
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTable() {
  console.log('Inspecting Payment table...');
  // Try to insert a dummy record to provoke a schema error or select * limit 1
  const { data, error } = await supabase.from('Payment').select('*').limit(1);
  
  if (data && data.length > 0) {
      console.log('Found record:', Object.keys(data[0]));
  } else {
      console.log('No records found, creating dummy check...');
      // Intentional error to see columns? No, better to just list empty object or try to insert with bad column
  }
}

inspectTable();
