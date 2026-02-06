-- 1. Create Role Table if not exists
CREATE TABLE IF NOT EXISTS public."Role" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  department text NOT NULL,
  "roleName" text NOT NULL,
  description text,
  tasks text,
  "currentOwner" text,
  "hiringTrigger" text,
  priority text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "Role_pkey" PRIMARY KEY (id)
);

-- 2. Seed Data
INSERT INTO public."Role" (department, "roleName", description, tasks, "currentOwner", "hiringTrigger") VALUES
('DIRECCIÓN', 'CEO / Director General', 'Que el barco no se hunda y sea rentable. Visión y Plata.', 'Definir hacia dónde vamos, revisar las cuentas, cerrar alianzas grandes.', 'Luca Gazze', 'Nunca (sos vos).'),
('DIRECCIÓN', 'COO / Gerente de Operaciones', 'Que las cosas pasen. Eficiencia y márgenes.', 'Organizar el quilombo interno, optimizar procesos, apagar incendios operativos.', 'Luca Gazze', 'Cuando vivís apagando incendios y no podés pensar en crecer.'),
('VENTAS', 'Director Comercial / Head of Growth', 'Que entre plata nueva. Facturación mensual.', 'Armar la estrategia de venta, definir precios, liderar al equipo de ventas.', 'Luca Gazze', 'Cuando tengas un equipo de 2 o 3 vendedores.'),
('VENTAS', 'Setter / Prospectador', 'Conseguir reuniones. Llenar la agenda.', 'Mandar mensajes (DMs) en frío, buscar empresas en LinkedIn, calificar si sirven o no.', 'Luca Gazze', 'PRIORIDAD ALTA. Es lo primero que se delega para que vos solo vendas.'),
('VENTAS', 'Cerrador / Closer', 'Cerrar el trato. Meter clientes adentro.', 'Tener las videollamadas de venta, negociar, mandar el contrato y cobrar.', 'Luca Gazze', 'Cuando tengas la agenda explotada de llamadas y no tengas tiempo de atenderlas.'),
('OPERACIONES', 'Account Manager / Cuentas', 'Que el cliente no se vaya. Retención.', 'Hablar con el cliente por WhatsApp, mandar reportes mensuales, tenerlos contentos.', 'Luca Gazze', 'Cuando tenés +10 clientes y el WhatsApp te explota de mensajes.'),
('OPERACIONES', 'Project Manager (PM)', 'Que se entregue a tiempo. Orden.', 'Asignar tareas en el Notion/Excel, perseguir al equipo para que cumplan fechas.', 'Luca Gazze', 'Cuando tenés 5 proyectos a la vez y se te empiezan a pasar las fechas.'),
('DESARROLLO', 'CTO / Líder Técnico', 'Que todo funcione técnico. Calidad.', 'Decidir qué tecnologías usar, revisar que el código esté limpio, arquitectura web.', 'Luca Gazze', 'Cuando el código te consuma el 100% del día y no puedas dirigir la empresa.'),
('DESARROLLO', 'Diseñador Web UI/UX', 'Que la web sea linda y útil. Estética.', 'Diseñar en Figma, armar prototipos, pensar la experiencia del usuario.', 'Luca Gazze', 'Cuando quieras dar un salto de calidad visual muy zarpado.'),
('DESARROLLO', 'Programador Frontend', 'Que la web se vea y ande. Maquetado.', 'Pasar el diseño a código, hacer animaciones, que ande rápido en el celular.', 'Luca Gazze', 'Cuando necesites sacar webs más rápido de lo que tus manos pueden escribir.'),
('MARKETING', 'Trafficker Digital (Media Buyer)', 'Comprar visitas baratas. Rentabilidad de anuncios.', 'Armar campañas en Meta/Google Ads, mirar métricas todos los días, ajustar presupuestos.', 'Luca Gazze', 'Cuando manejes mucha plata en publicidad de clientes y te dé miedo pifiarla.'),
('MARKETING', 'Especialista en Conversión (CRO)', 'Que las visitas compren. Tasa de venta.', 'Mirar mapas de calor, hacer tests A/B, mejorar los textos de la landing.', 'Luca Gazze', 'Cuando tenés mucho tráfico pero pocas ventas/consultas.'),
('CONTENIDO', 'Director Creativo', 'Que la marca tenga onda. Identidad.', 'Definir el estilo visual de Algoritmia y los clientes, bajar ideas locas a tierra.', 'Mariano', 'Nunca (Suele ser el socio creativo).'),
('CONTENIDO', 'Editor de Video (Reels/TikTok)', 'Videos dinámicos. Retención.', 'Editar crudos, poner subtítulos lindos, música, efectos de sonido, transiciones.', 'Mariano', 'Cuando el socio no dé abasto para editar todo lo que graban.'),
('CONTENIDO', 'Content Strategist / Guionista', 'Ideas que enganchen. Viralidad y Venta.', 'Escribir los guiones de los videos, pensar los ganchos, armar el calendario.', 'Mariano', 'Cuando se queden sin ideas o necesiten producir volumen masivo.'),
('ADMIN', 'Asistente Virtual / Admin', 'Sacarte lo aburrido. Tiempo libre.', 'Facturar, responder mails pavos, subir contenidos a redes, organizar agenda.', 'Luca Gazze', 'Contratar rápido para sacarse tareas repetitivas.');
