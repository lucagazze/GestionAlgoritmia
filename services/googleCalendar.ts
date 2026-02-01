import { supabase } from './supabase';

// CONFIGURACIÓN
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

// Estado interno
let gapiInited = false;
let isInitializing = false;

export const googleCalendarService = {
  
  // Verifica si tenemos un token de Google válido en la sesión de Supabase
  getIsAuthenticated: async () => {
    const { data } = await supabase.auth.getSession();
    return !!data.session?.provider_token;
  },

  logout: async () => {
    await supabase.auth.signOut();
    if ((window as any).gapi?.client) {
        (window as any).gapi.client.setToken(null);
    }
    localStorage.removeItem('google_refresh_token'); 
  },

  /**
   * 1. Carga los scripts de Google API (Solo la librería cliente básica)
   */
  loadScripts: () => {
    return new Promise<void>((resolve, reject) => {
      if (gapiInited) return resolve();
      
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        (window as any).gapi.load('client', async () => {
          try {
            await (window as any).gapi.client.init({
              discoveryDocs: [DISCOVERY_DOC],
            });
            gapiInited = true;
            // Intentar inyectar el token de la sesión actual
            await googleCalendarService.initializeSession();
            resolve();
          } catch (err) {
            console.error("Error cargando GAPI:", err);
            reject(err);
          }
        });
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  },

  /**
   * 2. Inyecta el token de Supabase en GAPI
   * Esta función se debe llamar al cargar la página y cuando cambie la sesión.
   */
  initializeSession: async () => {
    if (isInitializing) return;
    isInitializing = true;

    try {
      // Obtenemos sesión actual
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.provider_token && (window as any).gapi?.client) {
        // Le damos el token a Google Client
        (window as any).gapi.client.setToken({ 
            access_token: session.provider_token 
        });
        return true;
      }
    } catch (e) {
      console.error("Error inicializando sesión Google:", e);
    } finally {
      isInitializing = false;
    }
    return false;
  },

  /**
   * 3. Login OFICIAL con Supabase
   * Pide acceso 'offline' para que la conexión no muera en 1 hora.
   */
  authenticate: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin, // Vuelve a tu app
        scopes: 'https://www.googleapis.com/auth/calendar',
        queryParams: {
          access_type: 'offline', // CLAVE: Permite acceso continuo
          prompt: 'consent',      // CLAVE: Asegura recibir el Refresh Token
        },
      },
    });

    if (error) throw error;
  },

  // --- MÉTODOS DE CALENDARIO (CRUD) ---

  createEvent: async (eventData: { title: string, description: string, startTime: string, endTime: string }) => {
    await googleCalendarService.initializeSession(); 
    const event = {
      'summary': eventData.title,
      'description': eventData.description,
      'start': { 'dateTime': eventData.startTime, 'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone },
      'end': { 'dateTime': eventData.endTime, 'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone },
    };
    return (window as any).gapi.client.calendar.events.insert({ 'calendarId': 'primary', 'resource': event }).then((res: any) => res.result);
  },

  listEvents: async (timeMin?: string, timeMax?: string) => {
    await googleCalendarService.initializeSession();
    // Si falla por token expirado, Supabase debería haberlo refrescado, pero si GAPI falla, capturamos:
    try {
        const response = await (window as any).gapi.client.calendar.events.list({
        'calendarId': 'primary',
        'timeMin': timeMin || (new Date()).toISOString(),
        'timeMax': timeMax,
        'showDeleted': false,
        'singleEvents': true,
        'maxResults': 250,
        'orderBy': 'startTime'
        });
        return response.result.items;
    } catch (error: any) {
        console.error("Error listando eventos:", error);
        throw error; 
    }
  },

  updateEvent: async (eventId: string, eventData: any) => {
    await googleCalendarService.initializeSession();
    // 1. Obtener evento actual
    const getReq = await (window as any).gapi.client.calendar.events.get({ 'calendarId': 'primary', 'eventId': eventId });
    const current = getReq.result;
    
    // 2. Preparar payload (solo lo que cambió)
    const resource: any = { 
        ...current,
        summary: eventData.title || current.summary,
        description: eventData.description || current.description
    };
    
    if(eventData.startTime) resource.start = { dateTime: eventData.startTime, timeZone: current.start.timeZone };
    if(eventData.endTime) resource.end = { dateTime: eventData.endTime, timeZone: current.end.timeZone };

    // 3. Enviar update
    return (window as any).gapi.client.calendar.events.update({
      'calendarId': 'primary', 'eventId': eventId, 'resource': resource
    }).then((res: any) => res.result);
  },

  deleteEvent: async (eventId: string) => {
    await googleCalendarService.initializeSession();
    return (window as any).gapi.client.calendar.events.delete({ 'calendarId': 'primary', 'eventId': eventId });
  }
};
