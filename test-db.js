import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://omcdlfdgtnmolntmhits.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY2RsZmRndG5tb2xudG1oaXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODA4NTksImV4cCI6MjA4MzM1Njg1OX0.rzMrnKD0Q6jwGblx2OLQcW51g8nyp5geJJqWl44FlvY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  // Get the most recent ACCEPTED proposal
  const { data: proposals } = await supabase
    .from('Proposal')
    .select('*')
    .eq('status', 'ACCEPTED')
    .order('createdAt', { ascending: false })
    .limit(3);
  
  console.log("=== ACCEPTED Proposals (full data) ===");
  proposals?.forEach(p => {
    console.log(`--- Proposal ${p.id.substring(0, 8)} ---`);
    console.log(`  currency: ${p.currency}`);
    console.log(`  status: ${p.status}`);
    console.log(`  totalRecurringPrice: ${p.totalRecurringPrice}`);
    console.log(`  createdAt: ${p.createdAt}`);
    // Print all keys 
    console.log(`  All keys: ${Object.keys(p).join(', ')}`);
  });

  // Get the Client that was just approved (Skirting Factory)
  const { data: clients } = await supabase
    .from('Client')
    .select('id, name, currency, status, monthlyRevenue')
    .ilike('name', '%Skirting%');
  
  console.log("\n=== Skirting Factory Client ===");
  console.log(clients);

  // Try a test update on the Proposal
  if (proposals && proposals.length > 0) {
    const testId = proposals[0].id;
    console.log(`\nTesting update currency to USD on proposal ${testId.substring(0, 8)}...`);
    const { error } = await supabase.from('Proposal').update({ currency: 'USD' }).eq('id', testId);
    if (error) {
      console.error("Update FAILED:", error);
    } else {
      const { data: refreshed } = await supabase.from('Proposal').select('id, currency').eq('id', testId).single();
      console.log("After update:", refreshed?.currency);
      // Revert 
      await supabase.from('Proposal').update({ currency: 'ARS' }).eq('id', testId);
    }
  }
}

check();
