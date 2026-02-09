
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://omcdlfdgtnmolntmhits.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY2RsZmRndG5tb2xudG1oaXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODA4NTksImV4cCI6MjA4MzM1Njg1OX0.rzMrnKD0Q6jwGblx2OLQcW51g8nyp5geJJqWl44FlvY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectTable() {
  console.log('Inspecting Payment table for "client" column...');
  
  // Try 'client'
     const { data, error: insertError } = await supabase.from('Payment').insert({
        amount: 100,
        date: new Date().toISOString(),
        // Use a random UUID, if it fails due to FK constraint then the column EXISTS!
        client: '00000000-0000-0000-0000-000000000000'
    }).select();

    if (insertError) {
         console.log('Error:', insertError.message);
         // If error is "foreign key constraint violation", then 'client' is the correct column.
         // If error is "column 'client' does not exist", then it is wrong.
    } else {
        console.log('Success!', data);
    }
}

inspectTable();
