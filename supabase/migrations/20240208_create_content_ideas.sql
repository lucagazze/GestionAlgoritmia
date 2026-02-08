CREATE TABLE public.ContentIdea (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  concept text,
  hook text,
  script text,
  visuals text,
  platform text DEFAULT 'Instagram',
  status text DEFAULT 'IDEA',
  scheduledDate timestamp with time zone,
  createdAt timestamp with time zone DEFAULT now(),
  updatedAt timestamp with time zone DEFAULT now(),
  CONSTRAINT ContentIdea_pkey PRIMARY KEY (id)
);
