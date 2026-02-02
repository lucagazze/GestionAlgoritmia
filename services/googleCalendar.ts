
const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
const API_KEY = 'YOUR_API_KEY_HERE';

const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/calendar';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;
let isAuthenticated = false;

// Helpers to load scripts
const loadScript = (src: string) => {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
    });
};

export const googleCalendarService = {
  getIsAuthenticated: () => isAuthenticated,

  logout: () => {
    isAuthenticated = false;
    tokenClient = null;
    if ((window as any).gapi && (window as any).gapi.client) {
        (window as any).gapi.client.setToken(null);
    }
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expiry');
  },

  loadScripts: async () => {
      try {
          if (API_KEY === 'YOUR_API_KEY_HERE' || CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
              console.warn("Google Calendar API Key or Client ID is missing. Skipping GAPI load.");
              return;
          }
          await loadScript('https://apis.google.com/js/api.js');
          await new Promise<void>((resolve, reject) => {
              (window as any).gapi.load('client', { callback: resolve, onerror: reject });
          });
          await (window as any).gapi.client.init({
              apiKey: API_KEY,
              discoveryDocs: DISCOVERY_DOCS,
          });
          gapiInited = true;

          await loadScript('https://accounts.google.com/gsi/client');
          tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
              client_id: CLIENT_ID,
              scope: SCOPES,
              callback: (resp: any) => {
                  if (resp.error !== undefined) {
                      throw resp;
                  }
                  const expiry = new Date().getTime() + parseInt(resp.expires_in) * 1000;
                  localStorage.setItem('google_access_token', JSON.stringify(resp));
                  localStorage.setItem('google_token_expiry', expiry.toString());
                  isAuthenticated = true;
              },
          });
          gisInited = true;
      } catch (err) {
          console.error("Error loading GAPI", err);
      }
  },

  restoreSession: () => {
      const storedToken = localStorage.getItem('google_access_token');
      const expiry = localStorage.getItem('google_token_expiry');
      
      if (storedToken && expiry) {
          const now = new Date().getTime();
          if (now < parseInt(expiry)) {
              try {
                const token = JSON.parse(storedToken);
                (window as any).gapi.client.setToken(token);
                isAuthenticated = true;
                return true;
              } catch(e) {
                  return false;
              }
          } else {
              // Token expired
              localStorage.removeItem('google_access_token');
              localStorage.removeItem('google_token_expiry');
          }
      }
      return false;
  },

  authenticate: async (): Promise<boolean> => {
      if (!tokenClient) return false;
      return new Promise((resolve, reject) => {
          // This is a hacky way to wait for the callback helper, 
          // usually we trigger it and handle the callback globally or via a promise wrapper
          // But for simplicity, we trigger and assume the callback set in initTokenClient handles state
          
          // Re-init client to capture this specific promise context if needed?
          // Actually, standard GIS flow is trigger -> callback.
          // Let's rely on the callback updating state and we just trigger.
          
          // Override callback for this request?
          tokenClient.callback = (resp: any) => {
              if (resp.error) {
                  reject(resp);
              } else {
                 const expiry = new Date().getTime() + parseInt(resp.expires_in) * 1000;
                 localStorage.setItem('google_access_token', JSON.stringify(resp));
                 localStorage.setItem('google_token_expiry', expiry.toString());
                 isAuthenticated = true; 
                 resolve(true);
              }
          };

          const existingToken = (window as any).gapi.client.getToken();
          if (existingToken === null) {
              tokenClient.requestAccessToken({ prompt: 'consent' });
          } else {
              tokenClient.requestAccessToken({ prompt: '' });
          }
      });
  },

  listEvents: async (timeMin?: string, timeMax?: string) => {
      try {
          const response = await (window as any).gapi.client.calendar.events.list({
              'calendarId': 'primary',
              'timeMin': timeMin || (new Date()).toISOString(),
              'timeMax': timeMax,
              'showDeleted': false,
              'singleEvents': true,
              'maxResults': 100,
              'orderBy': 'startTime',
          });
          return response.result.items;
      } catch (e) {
          console.error("Error listing events", e);
          throw e; // Rethrow to handle in UI
      }
  },

  createEvent: async (eventData: { title: string; description: string; startTime: string; endTime: string }) => {
      const event = {
          'summary': eventData.title,
          'description': eventData.description,
          'start': {
              'dateTime': eventData.startTime,
              'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          'end': {
              'dateTime': eventData.endTime,
              'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
      };

      const request = (window as any).gapi.client.calendar.events.insert({
          'calendarId': 'primary',
          'resource': event,
      });

      const response = await request;
      return response.result;
  },

  updateEvent: async (eventId: string, eventData: { title: string; description: string; startTime: string; endTime: string }) => {
      const event = {
          'summary': eventData.title,
          'description': eventData.description,
          'start': {
              'dateTime': eventData.startTime,
              'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          'end': {
              'dateTime': eventData.endTime,
              'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
      };
      
      const response = await (window as any).gapi.client.calendar.events.update({
          'calendarId': 'primary',
          'eventId': eventId,
          'resource': event
      });
      return response.result;
  },

  deleteEvent: async (eventId: string) => {
      return (window as any).gapi.client.calendar.events.delete({
          'calendarId': 'primary',
          'eventId': eventId
      });
  }
};
