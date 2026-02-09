
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://omcdlfdgtnmolntmhits.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY2RsZmRndG5tb2xudG1oaXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODA4NTksImV4cCI6MjA4MzM1Njg1OX0.rzMrnKD0Q6jwGblx2OLQcW51g8nyp5geJJqWl44FlvY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectTable() {
  console.log('Inspecting Payment table...');
  const { data, error } = await supabase.from('Payment').select('*').limit(1);
  
  if (data && data.length > 0) {
      console.log('Found record keys:', Object.keys(data[0]));
  } else {
      console.log('No records found.');
      // I need to know the columns.
      // Let's try to fetch a known payment by ID if possible? No.
      // Let's try to query the schema directly if possible via rpc?
      // const { data, error } = await supabase.rpc('get_columns', { table_name: 'Payment' });
      // Not likely to exist.
  }
}

inspectTable();
