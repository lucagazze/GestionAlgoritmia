
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Hardcoded for testing
const supabaseUrl = "https://omcdlfdgtnmolntmhits.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY2RsZmRndG5tb2xudG1oaXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODA4NTksImV4cCI6MjA4MzM1Njg1OX0.rzMrnKD0Q6jwGblx2OLQcW51g8nyp5geJJqWl44FlvY";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    console.log("Checking ContractorPayment table...");

    // 1. Try to select (Read)
    const { data, error } = await supabase.from('ContractorPayment').select('*').limit(1);
    
    if (error) {
        console.error("Error selecting from ContractorPayment:", JSON.stringify(error, null, 2));
        
        // Try lowercase
        console.log("Trying lowercase 'contractorpayment'...");
        const { data: dataLow, error: errorLow } = await supabase.from('contractorpayment').select('*').limit(1);
        if (errorLow) {
             console.error("Error selecting from contractorpayment:", JSON.stringify(errorLow, null, 2));
        } else {
             console.log("Success with lowercase 'contractorpayment'!");
        }
    } else {
        console.log("Success reading ContractorPayment!", data);
    }

    // 2. Try to insert a dummy record (if read worked or to test write)
    // We need valid IDs. Let's fetch a contractor first.
    const { data: contractors } = await supabase.from('Contractor').select('id').limit(1);
    if (!contractors || contractors.length === 0) {
        // Try lowercase contractor
         const { data: contractorsLow } = await supabase.from('contractor').select('id').limit(1);
         if (contractorsLow && contractorsLow.length > 0) {
             console.log("Found contractor (low):", contractorsLow[0]);
             await testInsert('contractorpayment', contractorsLow[0].id);
         } else {
             console.log("No contractors found to test insert.");
         }
    } else {
        console.log("Found contractor:", contractors[0]);
        await testInsert('ContractorPayment', contractors[0].id);
    }
}

async function testInsert(tableName, contractorId) {
    console.log(`Attempting insert into ${tableName}...`);
    const { data, error } = await supabase.from(tableName).insert({
        contractor_id: contractorId,
        amount: 100,
        description: 'Test Payment'
    }).select().single();

    if (error) {
        console.error("Insert Error:", JSON.stringify(error, null, 2));
    } else {
        console.log("Insert Success:", data);
        // Clean up
        await supabase.from(tableName).delete().eq('id', data.id);
    }
}

checkTable();
