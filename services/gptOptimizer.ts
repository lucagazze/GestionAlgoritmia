import { supabase } from './supabase';

export interface AdMetric {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  adset_name: string;
  spend: number;
  purchases: number;
  revenue: number;
}

export async function fetchAdMetrics(clientId: string, dateRange: {start: Date, end: Date}) {
  const { data, error } = await supabase
    .from('ad_metrics')
    .select('*')
    .eq('client_id', clientId)
    .gte('date', dateRange.start.toISOString())
    .lte('date', dateRange.end.toISOString());

  if (error) {
    if (error.code === 'PGRST205') {
       console.warn("Table ad_metrics not found. Returning empty.");
       return [];
    }
    throw error;
  }

  const processedData = data.map(ad => {
    const cpa = ad.purchases > 0 ? ad.spend / ad.purchases : ad.spend;
    const aov = ad.purchases > 0 ? ad.revenue / ad.purchases : 0;
    const gpt = aov - cpa;

    return {
      ...ad,
      cpa,
      aov,
      gpt,
      bubbleSize: Math.max(10, Math.min(ad.spend / 10, 100)) 
    };
  });

  return processedData;
}
