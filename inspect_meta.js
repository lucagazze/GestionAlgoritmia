import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://omcdlfdgtnmolntmhits.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY2RsZmRndG5tb2xudG1oaXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODA4NTksImV4cCI6MjA4MzM1Njg1OX0.rzMrnKD0Q6jwGblx2OLQcW51g8nyp5geJJqWl44FlvY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const { data } = await supabase.from('AgencySettings').select('value').eq('key', 'meta_ads_token').maybeSingle();
  const token = data.value;

  const insFields = [
    'ad_id', 'ad_name', 'adset_id', 'adset_name',
    'campaign_id', 'campaign_name',
    'spend', 'actions', 'action_values', 'purchase_roas',
  ].join(',');

  const r = await fetch(`https://graph.facebook.com/v21.0/act_2136106490563351/insights?access_token=${token}&fields=${insFields}&level=ad&limit=50&date_preset=last_7d`);
  const json = await r.json();
  const ads = json.data;
  
  if (!ads) {
     console.log("No ads returned or error", json);
     return;
  }

  const getMetaVal = (arr, ...types) => {
    for (const t of types) {
      const v = arr?.find((a) => a.action_type === t)?.value;
      if (v != null && parseFloat(v) > 0) return parseFloat(v);
    }
    return 0;
  };

  let totalSpend = 0;
  let totalRevenue = 0;
  let totalResults = 0;

  for (const ins of ads) {
      const spend = parseFloat(ins.spend || '0');
      const actions = ins.actions || [];
      const actionValues = ins.action_values || [];

      const revenue = getMetaVal(actionValues, 'offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase', 'onsite_conversion.purchase');
      const hasRevenue = revenue > 0;
      let conversions = 0;
      if (hasRevenue) {
         conversions = getMetaVal(actions, 'offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase', 'onsite_conversion.purchase');
      } else {
         conversions = getMetaVal(actions, 'lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped', 'onsite_conversion.messaging_conversation_started_7d', 'link_click');
      }

      console.log(`Ad: ${ins.ad_name} | Spend: ${spend} | Actions Length: ${actions.length} | Rev: ${revenue} | Conv: ${conversions}`);

      totalSpend += spend;
      totalRevenue += revenue;
      totalResults += conversions;
  }

  console.log(`\nTOTALS:`);
  console.log(`Spend: ${totalSpend}`);
  console.log(`Revenue: ${totalRevenue}`);
  console.log(`Results: ${totalResults}`);
  console.log(`Calculated CPA: ${totalResults > 0 ? totalSpend / totalResults : 0}`);
  console.log(`Calculated GPT: ${totalResults > 0 ? (totalRevenue - totalSpend) / totalResults : 0}`);
}

main();
