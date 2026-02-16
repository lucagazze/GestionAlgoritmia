
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://omcdlfdgtnmolntmhits.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY2RsZmRndG5tb2xudG1oaXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODA4NTksImV4cCI6MjA4MzM1Njg1OX0.rzMrnKD0Q6jwGblx2OLQcW51g8nyp5geJJqWl44FlvY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const fs = require('fs');

async function inspectClientDates() {
  console.log('Inspecting Client Dates...');
  
  const { data: clients, error } = await supabase
    .from('Client')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching clients:', error);
    return;
  }
  
  const keys = Object.keys(clients[0] || {});
  let output = `--- Client Columns (${keys.length}) ---\n`;
  output += keys.join(', ') + '\n';
  
  output += '\n--- Data Sample ---\n';
  // Also dump billing_day specifically if it exists
  const { data: allClients } = await supabase.from('Client').select('name, billing_day, billingDay, "billingDay", "billing_day"');
  if (allClients) {
      allClients.forEach(c => {
          output += `${c.name}: ${JSON.stringify(c)}\n`;
      });
  }
  
  fs.writeFileSync('client_columns_dump.txt', output);
  console.log('Dump written to client_columns_dump.txt');
}

inspectClientDates();
