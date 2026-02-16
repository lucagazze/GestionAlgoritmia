-- Create ContractorPayment table
CREATE TABLE public."ContractorPayment" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL,
  client_id uuid, -- Optional: Link to a specific project source
  amount numeric NOT NULL DEFAULT 0,
  date timestamp with time zone DEFAULT now(),
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT "ContractorPayment_pkey" PRIMARY KEY (id),
  CONSTRAINT "ContractorPayment_contractor_id_fkey" FOREIGN KEY (contractor_id) REFERENCES public."Contractor"(id),
  CONSTRAINT "ContractorPayment_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public."Client"(id)
);

-- Add RLS policies if needed
ALTER TABLE public."ContractorPayment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read/write for authenticated users only" ON public."ContractorPayment"
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
