
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTable() {
  console.log('Inspecting Payment table...');
  const { data, error } = await supabase.from('Payment').select('*').limit(1);
  
  if (data && data.length > 0) {
      console.log('Found record keys:', Object.keys(data[0]));
  } else if (error) {
      console.error('Error selecting from Payment:', error);
  } else {
      console.log('No records found. Attempting to insert dummy to see error...');
      const { error: insertError } = await supabase.from('Payment').insert({
          amount: 1,
          date: new Date().toISOString(),
          dummy_column: 'test' // Intentional error to list columns if PG returns them
      });
      if (insertError) {
          console.log('Insert error (might reveal columns):', insertError);
      }
  }
}

inspectTable();
