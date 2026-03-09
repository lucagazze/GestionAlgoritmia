import { supabase } from './services/supabase.ts';

async function findAndDelete() {
  const { data, error } = await supabase
    .from('ContractorPayment')
    .select('*');

  if (error) {
    console.error("Error fetching defaults:", error);
    return;
  }
  
  const targetPayments = data.filter(p => {
    const isMarch = new Date(p.date).getMonth() === 2; // March is 2
    const amountVal = Number(p.amount);
    return isMarch && amountVal === 250000;
  });

  console.log("Found ContractorPayments matching 250k in March:", targetPayments);
}

findAndDelete();
