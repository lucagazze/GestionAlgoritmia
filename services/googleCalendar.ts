
import { db } from './db';

const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

// ID Proporcionado por el usuario (Público/Seguro para frontend)
const DEFAULT_CLIENT_ID = "461911891249-m1dahst7hd2nlm2tj8iigitm70d6lpia.apps.googleusercontent.com";

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export const googleCalendarService = {
  
  /**
   * Carga los scripts necesarios de Google (GAPI y GIS) dinámicamente
   */
  loadScripts: () => {
    return new Promise<void>((resolve, reject) => {
        // Load GAPI
        const script1 = document.createElement('script');
        script1.src = 'https://apis.google.com/js/api.js';
        script1.async = true;
        script1.defer = true;
        script1.onload = () => {
            (window as any).gapi.load('client', async () => {
                await (window as any).gapi.client.init({
                    discoveryDocs: [DISCOVERY_DOC],
                });
                gapiInited = true;
                if (gisInited) resolve();
            });
        };
        script1.onerror = reject;
        document.body.appendChild(script1);

        // Load GIS
        const script2 = document.createElement('script');
        script2.src = 'https://accounts.google.com/gsi/client';
        script2.async = true;
        script2.defer = true;
        script2.onload = async () => {
            // Intentar inicializar con el ID por defecto para agilizar
            try {
                let clientId = await db.settings.getApiKey('google_oauth_client_id');
                if (!clientId) clientId = DEFAULT_CLIENT_ID;

                if (clientId) {
                    tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
                        client_id: clientId,
                        scope: SCOPES,
                        callback: '', // Defined later
                    });
                }
            } catch (e) {
                console.error("Error init token client", e);
            }
            
            gisInited = true;
            if (gapiInited) resolve();
        };
        script2.onerror = reject;
        document.body.appendChild(script2);
    });
  },

  /**
   * Inicia el flujo de login (Popup de Google)
   */
  authenticate: async (): Promise<boolean> => {
      // Re-check ID in case it was just saved or needed initialization
      if (!tokenClient) {
          let clientId = await db.settings.getApiKey('google_oauth_client_id');
          if (!clientId) clientId = DEFAULT_CLIENT_ID;
          
          if (!clientId) throw new Error("Falta configurar el 'OAuth Client ID' en Ajustes.");
          
          tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
              client_id: clientId,
              scope: SCOPES,
              callback: '',
          });
      }

      return new Promise((resolve, reject) => {
          tokenClient.callback = async (resp: any) => {
              if (resp.error !== undefined) {
                  reject(resp);
              }
              resolve(true);
          };
          
          // Trigger the popup
          // Check if we already have a valid token to skip popup if possible (though explicit flow usually requires popup first time)
          const existingToken = (window as any).gapi.client.getToken();
          if (existingToken === null) {
              tokenClient.requestAccessToken({ prompt: 'consent' });
          } else {
              tokenClient.requestAccessToken({ prompt: '' });
          }
      });
  },

  /**
   * Sube un evento a Google Calendar
   */
  createEvent: async (eventData: { title: string, description: string, startTime: string, endTime: string }) => {
      try {
          const event = {
              'summary': eventData.title,
              'description': eventData.description,
              'start': {
                  'dateTime': eventData.startTime, // ISO string
                  'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
              },
              'end': {
                  'dateTime': eventData.endTime,
                  'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
              },
              'reminders': {
                  'useDefault': false,
                  'overrides': [
                      {'method': 'email', 'minutes': 24 * 60},
                      {'method': 'popup', 'minutes': 10}
                  ]
              }
          };

          const request = (window as any).gapi.client.calendar.events.insert({
              'calendarId': 'primary',
              'resource': event
          });

          const response = await request;
          return response;
      } catch (error) {
          console.error("Error creating Google Calendar event", error);
          throw error;
      }
  }
};
