
// Meta Marketing API — READ ONLY. Never call POST/PATCH/DELETE endpoints.
const TOKEN = 'EAARvpoGdZCfIBQwb0WTFKhdp9GZC0FNtwavqEyhZAGDrdo3P711EUdbv4NEiPrw79eLwLf3ZBGSR2Cq3uKY7nIMRuvOOhgxbkHfXR20nWQxq6yQ7XPE5gVtWLU9q2QZCtZAOZBWbTXKgia8jaN1WWWobrMjTR7MaEijYWhjZAMIEml7EMpNbeh1fdpMl2CuXHCViR5jove7YZATM4j9pL2keEXgGBsTVHeMFC5oWvZCBdEarSDE5N5a5iwJ8IiELkS6eL5vfCdtUha8UYcLgfaedNB4Upk';
export const META_AD_ACCOUNT = 'act_2136106490563351';
const BASE = 'https://graph.facebook.com/v21.0';

// Instagram Business IDs de cuentas accesibles via Pages API
export const INSTAGRAM_ACCOUNTS: Record<string, { igId: string; username: string }> = {
  'algoritmia': { igId: '17841454001497804', username: 'algoritmia.ads' },
};

// Mapping clientId Supabase → Meta page/Instagram data (agregar aquí nuevos clientes)
// Formato: { [clientId]: { igId, username, adAccountId? } }
export const CLIENT_META_MAP: Record<string, { igId?: string; username?: string; adAccountId?: string }> = {
  // The Skirting Factory
  'df57e4cd-6433-4c2f-a42f-4ad7e59d30dc': { adAccountId: META_AD_ACCOUNT },
  // Atérmicos Pinamar
  '02504445-7e44-4599-8b62-6c44a1af4b24': { igId: '17841460101454399', username: 'atermicos.pinamar' },
  // Librería Mayorista Leo
  'e0141716-178d-483b-8c2c-a58d391b83a1': { igId: '17841438390504961', username: 'libreriamayoristaleo' },
  // Rocío Fuentes
  'b6d2f956-18c2-42d4-af3d-5a55442c234a': { igId: '17841446979077762', username: 'lic.rociofuentes' },
  // Puertas Blindadas Jack
  '9cc15a64-897f-412f-a048-86791ed04185': { igId: '17841421861661046', username: 'puertasblindasasjack' },
  // Selecta
  '51a050d9-5f32-4f95-8724-8eefff9666d6': { igId: '17841463377689897', username: 'selecta' },
};

type DatePreset = 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'this_month' | 'last_month';

const apiGet = async (endpoint: string, params: Record<string, string> = {}): Promise<any> => {
  const url = new URL(`${BASE}/${endpoint}`);
  url.searchParams.set('access_token', TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json();
};

export const metaAds = {
  // ── AD ACCOUNT ────────────────────────────────────────────
  getAccount: () =>
    apiGet(META_AD_ACCOUNT, {
      fields: 'name,currency,timezone_name,account_status,amount_spent,balance,daily_spend_limit',
    }),

  // ── CAMPAIGNS ─────────────────────────────────────────────
  getCampaigns: () =>
    apiGet(`${META_AD_ACCOUNT}/campaigns`, {
      fields: 'id,name,status,objective,buying_type,daily_budget,lifetime_budget,start_time,stop_time,bid_strategy',
      limit: '50',
    }),

  // ── ADSETS ────────────────────────────────────────────────
  getAdsets: (campaignId?: string) =>
    apiGet(campaignId ? `${campaignId}/adsets` : `${META_AD_ACCOUNT}/adsets`, {
      fields: 'id,name,status,campaign_id,daily_budget,lifetime_budget,optimization_goal,billing_event,targeting,start_time,end_time',
      limit: '50',
    }),

  // ── ADS ───────────────────────────────────────────────────
  getAds: (adsetId?: string) =>
    apiGet(adsetId ? `${adsetId}/ads` : `${META_AD_ACCOUNT}/ads`, {
      fields: 'id,name,status,adset_id,creative',
      limit: '50',
    }),

  // ── INSIGHTS ──────────────────────────────────────────────
  getInsights: async (
    objectId: string,
    fields = 'spend,impressions,reach,clicks,cpm,cpc,ctr,frequency,actions,cost_per_action_type',
    datePreset: DatePreset = 'last_30d'
  ) => {
    const res = await apiGet(`${objectId}/insights`, {
      fields,
      date_preset: datePreset,
      limit: '1',
    });
    return (res.data || [])[0] || null;
  },

  // ── CREATIVE DETAIL ───────────────────────────────────────
  getCreative: (creativeId: string) =>
    apiGet(creativeId, {
      fields: 'name,title,body,call_to_action_type,object_url,image_url,video_id',
    }),

  // ── INSTAGRAM ─────────────────────────────────────────────
  getInstagramProfile: (igId: string) =>
    apiGet(igId, {
      fields: 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website',
    }),

  getInstagramMedia: (igId: string, limit = 12) =>
    apiGet(`${igId}/media`, {
      fields: 'id,caption,media_type,timestamp,like_count,comments_count,permalink,thumbnail_url,media_url',
      limit: String(limit),
    }),

  getInstagramInsights: (igId: string) =>
    apiGet(`${igId}/insights`, {
      metric: 'impressions,reach,profile_views,follower_count',
      period: 'day',
      limit: '30',
    }),
};
