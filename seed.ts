import { Service, ServiceType } from './types';

// NOTE: In a real Node environment, this would import PrismaClient and write to DB.
// For this environment, we export the data to be used by the mock DB service.

export const initialServices: Omit<Service, 'id'>[] = [
  // --- WEB & TECH ---
  {
    name: "Landing Page (High-Converting)",
    category: "Web & Tech",
    type: ServiceType.ONE_TIME,
    baseCost: 200,
    description: "Una sola página larga (Sales Page), Copy persuasivo, Carga <1s, Pixel instalado."
  },
  {
    name: "Sitio Corporativo (Brand)",
    category: "Web & Tech",
    type: ServiceType.ONE_TIME,
    baseCost: 250,
    description: "Home + Nosotros + Servicios + Contacto. Diseño premium. CMS autoadministrable."
  },
  {
    name: "E-Commerce (Shopify/Woo)",
    category: "Web & Tech",
    type: ServiceType.ONE_TIME,
    baseCost: 250,
    description: "Tienda completa, pasarela de pagos, carga de hasta 20 productos, email transaccional."
  },
  {
    name: "Web App / SaaS MVP",
    category: "Web & Tech",
    type: ServiceType.ONE_TIME,
    baseCost: 1500, // Precio base estimado
    description: "Desarrollo a medida con React/Next.js, base de datos, login de usuarios."
  },
  {
    name: "Mantenimiento Web Mensual",
    category: "Web & Tech",
    type: ServiceType.RECURRING,
    baseCost: 20,
    description: "Backups semanales, actualización de plugins, seguridad, pequeños cambios de texto."
  },
  {
    name: "Setup de Analytics & Tracking",
    category: "Web & Tech",
    type: ServiceType.ONE_TIME,
    baseCost: 40,
    description: "Configuración profesional de GA4, Tag Manager y Pixel de Meta (Server Side)."
  },

  // --- BRANDING ---
  {
    name: "Identidad Visual (Logo)",
    category: "Branding",
    type: ServiceType.ONE_TIME,
    baseCost: 150,
    description: "Logo (variaciones), Paleta de Colores, Tipografías."
  },
  {
    name: "Manual de Marca Completo",
    category: "Branding",
    type: ServiceType.ONE_TIME,
    baseCost: 250,
    description: "Lo anterior + Usos correctos, Tono de voz, Aplicaciones (Mockups), Patrones."
  },
  {
    name: "Social Media Kit",
    category: "Branding",
    type: ServiceType.ONE_TIME,
    baseCost: 400,
    description: "5 Plantillas editables para Feed (Canva/Figma) + 3 Plantillas de Stories + Portadas."
  },
  {
    name: "Diseño de Pitch Deck",
    category: "Branding",
    type: ServiceType.ONE_TIME,
    baseCost: 500,
    description: "Presentación de ventas en PDF/PPT (15 slides) con diseño de alto impacto."
  },
  {
    name: "Diseño UI (Solo Diseño)",
    category: "Branding",
    type: ServiceType.ONE_TIME,
    baseCost: 100,
    description: "Diseño de interfaz en Figma (sin programar) para que otro desarrolle."
  },

  // --- CONTENIDO ---
  {
    name: "Pack Reels (Solo Edición)",
    category: "Contenido",
    type: ServiceType.RECURRING,
    baseCost: 500,
    description: "Edición de 8 a 12 videos cortos (el cliente graba). Subtítulos dinámicos."
  },
  {
    name: "Pack Reels (Full Production)",
    category: "Contenido",
    type: ServiceType.RECURRING,
    baseCost: 1500,
    description: "Guion + Dirección + Grabación (Presencial) + Edición de 4 a 8 videos."
  },
  {
    name: "Gestión de RRSS (Community)",
    category: "Contenido",
    type: ServiceType.RECURRING,
    baseCost: 400,
    description: "Subida de posteos, redacción de copys, respuesta a comentarios (L-V), Stories diarias."
  },
  {
    name: "Diseño de Carruseles (x Unidad)",
    category: "Contenido",
    type: ServiceType.ONE_TIME,
    baseCost: 50,
    description: "Carrusel educativo de 5-8 slides. Aporte de valor técnico."
  },
  {
    name: "Estrategia de Contenidos",
    category: "Contenido",
    type: ServiceType.ONE_TIME,
    baseCost: 400,
    description: "Calendario editorial mensual, pilares de contenido, ganchos y guiones (sin edición)."
  },

  // --- ADS / TRÁFICO ---
  {
    name: "Setup de Campañas (Inicio)",
    category: "Ads / Tráfico",
    type: ServiceType.ONE_TIME,
    baseCost: 50,
    description: "Investigación de audiencia, creación de cuenta publicitaria, estructura inicial."
  },
  {
    name: "Gestión Meta Ads (Fee)",
    category: "Ads / Tráfico",
    type: ServiceType.RECURRING,
    baseCost: 150,
    description: "Optimización diaria, A/B testing, escalado. (No incluye presupuesto publicitario)."
  },
  {
    name: "Gestión Google Ads (Search)",
    category: "Ads / Tráfico",
    type: ServiceType.RECURRING,
    baseCost: 300, // Precio base estimado
    description: "Gestión de campañas de búsqueda (intención de compra). Palabras clave negativas."
  },
  {
    name: "Pack Creativos para Ads",
    category: "Ads / Tráfico",
    type: ServiceType.RECURRING,
    baseCost: 100,
    description: "Diseño de 4 a 6 piezas gráficas o edición de video UGC específicamente para vender."
  },

  // --- AUTOMATIZACIÓN ---
  {
    name: "Implementación CRM",
    category: "Automatización",
    type: ServiceType.ONE_TIME,
    baseCost: 400, // Precio base estimado
    description: "Configurar HubSpot/Kommo. Crear embudo de ventas (Pipelines). Importar contactos."
  },
  {
    name: "Email Marketing (Flows)",
    category: "Automatización",
    type: ServiceType.ONE_TIME,
    baseCost: 300, // Precio base estimado
    description: "Secuencia de bienvenida (3 emails), Recuperación de carrito (2 emails). Setup + Copy."
  },
  {
    name: "Automatización (Zapier/Make)",
    category: "Automatización",
    type: ServiceType.ONE_TIME, // Tratado como One Time por proceso
    baseCost: 150, // Precio base estimado
    description: "Ej: 'Cuando alguien llena el formulario web, le llega un WhatsApp y se agendada en CRM'."
  },
  {
    name: "Chatbot AI (Básico)",
    category: "Automatización",
    type: ServiceType.ONE_TIME,
    baseCost: 300, // Precio base estimado
    description: "Bot entrenado con info de la empresa para responder preguntas frecuentes 24/7."
  },

  // --- CONSULTORÍA ---
  {
    name: "Auditoría Estratégica (Video)",
    category: "Consultoría",
    type: ServiceType.ONE_TIME,
    baseCost: 300,
    description: "Video Loom de 20 min analizando fallas de la web y redes actuales."
  },
  {
    name: "Mentoria 1 a 1 (Acompañamiento)",
    category: "Consultoría",
    type: ServiceType.RECURRING,
    baseCost: 800,
    description: "2 llamadas al mes de 60 min + soporte por WhatsApp L-V."
  }
];
