
import { db } from './db';

// SCOPE ACTUALIZADO: Permite ver, editar, compartir y borrar permanentemente todos los calendarios
const SCOPES = 'https://www.googleapis.com/auth/calendar'; 
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

// ID Proporcionado por el usuario (Fijo y Prioritario)
const DEFAULT_CLIENT_ID = "461911891249-m1dahst7hd2nlm2tj8iigitm70d6lpia.apps.googleusercontent.com";

let tokenClient: any;
let gapiInited = false;
let gisInited = false;
let isAuthenticated = false;

// Store the resolve function for the authentication promise
let authResolve: ((value: boolean) => void) | null = null;
let authReject: ((reason?: any) => void) | null = null;

export const googleCalendarService = {
  
  getIsAuthenticated: () => isAuthenticated,

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
            try {
                // Usar siempre el ID por defecto si existe, o buscar en DB como fallback
                let clientId = DEFAULT_CLIENT_ID;
                if (!clientId) {
                    const dbKey = await db.settings.getApiKey('google_oauth_client_id');
                    if (dbKey) clientId = dbKey;
                }

                if (clientId) {
                    tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
                        client_id: clientId.trim(), // IMPORTANT: Trim whitespace
                        scope: SCOPES,
                        callback: (resp: any) => {
                            if (resp.error !== undefined) {
                                if (authReject) authReject(resp);
                            } else {
                                isAuthenticated = true;
                                if (authResolve) authResolve(true);
                            }
                        },
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
      // Re-check ID logic por si no se inicializó al cargar
      if (!tokenClient) {
          let clientId = DEFAULT_CLIENT_ID;
          if (!clientId) {
              const dbKey = await db.settings.getApiKey('google_oauth_client_id');
              if (dbKey) clientId = dbKey;
          }
          
          if (!clientId) throw new Error("Falta configurar el 'OAuth Client ID' en Ajustes o en el código.");
          
          tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
              client_id: clientId.trim(),
              scope: SCOPES,
              callback: (resp: any) => {
                  if (resp.error !== undefined) {
                      if (authReject) authReject(resp);
                  } else {
                      isAuthenticated = true;
                      if (authResolve) authResolve(true);
                  }
              },
          });
      }

      return new Promise((resolve, reject) => {
          authResolve = resolve;
          authReject = reject;
          
          // Trigger the popup
          const existingToken = (window as any).gapi.client.getToken();
          if (existingToken === null) {
              tokenClient.requestAccessToken({ prompt: 'consent' });
          } else {
              tokenClient.requestAccessToken({ prompt: '' });
          }
      });
  },

  /**
   * Sube un evento a Google Calendar (INSERT)
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
                      {'method': 'popup', 'minutes': 10}
                  ]
              }
          };

          const request = (window as any).gapi.client.calendar.events.insert({
              'calendarId': 'primary',
              'resource': event
          });

          const response = await request;
          return response.result;
      } catch (error) {
          console.error("Error creating Google Calendar event", error);
          throw error;
      }
  },

  /**
   * Lista los eventos de un calendario (LIST)
   */
  listEvents: async (timeMin?: string, timeMax?: string) => {
      try {
          const request = (window as any).gapi.client.calendar.events.list({
              'calendarId': 'primary',
              'timeMin': timeMin || (new Date()).toISOString(),
              'showDeleted': false,
              'singleEvents': true,
              'maxResults': 100,
              'orderBy': 'startTime'
          });

          const response = await request;
          return response.result.items;
      } catch (error) {
          console.error("Error listing Google Calendar events", error);
          throw error;
      }
  },

  /**
   * Actualiza un evento existente (UPDATE / PATCH)
   */
  updateEvent: async (eventId: string, eventData: { title?: string, description?: string, startTime?: string, endTime?: string }) => {
      try {
          // Primero obtenemos el evento actual para no sobrescribir otros campos
          const getRequest = (window as any).gapi.client.calendar.events.get({
              'calendarId': 'primary',
              'eventId': eventId
          });
          const currentEvent = (await getRequest).result;

          const updatedResource: any = { ...currentEvent };
          
          if (eventData.title) updatedResource.summary = eventData.title;
          if (eventData.description) updatedResource.description = eventData.description;
          if (eventData.startTime) updatedResource.start = { dateTime: eventData.startTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
          if (eventData.endTime) updatedResource.end = { dateTime: eventData.endTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };

          const request = (window as any).gapi.client.calendar.events.update({
              'calendarId': 'primary',
              'eventId': eventId,
              'resource': updatedResource
          });

          const response = await request;
          return response.result;
      } catch (error) {
          console.error("Error updating Google Calendar event", error);
          throw error;
      }
  },

  /**
   * Elimina un evento (DELETE)
   */
  deleteEvent: async (eventId: string) => {
      try {
          const request = (window as any).gapi.client.calendar.events.delete({
              'calendarId': 'primary',
              'eventId': eventId
          });

          await request;
          return true;
      } catch (error) {
          console.error("Error deleting Google Calendar event", error);
          throw error;
      }
  },

  /**
   * Lista todos los calendarios disponibles (LIST CALENDARS)
   */
  listCalendars: async () => {
      try {
          const request = (window as any).gapi.client.calendar.calendarList.list();
          const response = await request;
          return response.result.items;
      } catch (error) {
          console.error("Error listing calendars", error);
          throw error;
      }
  }
};
