
const { createClient } = require('@supabase/supabase-js');

// Credentials from supabase.ts
const SUPABASE_URL = "https://omcdlfdgtnmolntmhits.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY2RsZmRndG5tb2xudG1oaXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODA4NTksImV4cCI6MjA4MzM1Njg1OX0.rzMrnKD0Q6jwGblx2OLQcW51g8nyp5geJJqWl44FlvY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
          dummy_column_intentionally_wrong: 'test' 
      });
      if (insertError) {
          console.log('Insert error msg:', insertError.message);
      }
  }
}

inspectTable();
