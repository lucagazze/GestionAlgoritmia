
import { createClient } from '@supabase/supabase-js';

// Credentials from supabase.ts
const SUPABASE_URL = "https://omcdlfdgtnmolntmhits.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY2RsZmRndG5tb2xudG1oaXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODA4NTksImV4cCI6MjA4MzM1Njg1OX0.rzMrnKD0Q6jwGblx2OLQcW51g8nyp5geJJqWl44FlvY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectTables() {
  console.log('Inspecting Tables...');
  
  // Try to select from Contractor to see if it works with different casings
  const casings = ['Contractor', 'contractor', 'CONTRACTOR', 'Contractors', 'contractors', 'Contractors_duplicate'];
  
  for (const table of casings) {
      const { data, error } = await supabase.from(table).select('id').limit(1);
      if (!error) {
          console.log(`✅ Table found: "${table}"`);
          return;
      } else {
          console.log(`❌ Table not found as "${table}": ${error.message} (${error.code})`);
      }
  }
}

inspectTables();
