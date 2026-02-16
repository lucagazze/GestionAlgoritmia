
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://omcdlfdgtnmolntmhits.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY2RsZmRndG5tb2xudG1oaXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODA4NTksImV4cCI6MjA4MzM1Njg1OX0.rzMrnKD0Q6jwGblx2OLQcW51g8nyp5geJJqWl44FlvY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkColumns() {
  console.log('Checking Client table columns...');
  
  // Try to update the new columns on a dummy ID to see if it throws "column does not exist"
  const { error } = await supabase.from('Client').update({ 
      billing_day: 1,
      contract_end_date: new Date().toISOString(),
      service_details: 'Test'
  }).eq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
      console.error("❌ Error updating new columns:", error.message);
      if (error.message.includes('column') && error.message.includes('does not exist')) {
          console.log("⚠️ CONFIRMED: Columns are missing from the database.");
          console.log("You must run the migration: supabase/migrations/20260216_add_contract_columns.sql");
      }
      if (error.code === '42703') { // Undefined column
           console.log("⚠️ CONFIRMED: Columns refer to undefined columns.");
      }
  } else {
      console.log("✅ Columns seem to exist (or update on dummy ID passed, depending on RLS).");
  }
}

checkColumns();
