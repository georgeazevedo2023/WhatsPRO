
-- 1. Create departments table
CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  inbox_id uuid NOT NULL REFERENCES public.inboxes(id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Create department_members table
CREATE TABLE public.department_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(department_id, user_id)
);

-- 3. Add department_id to conversations
ALTER TABLE public.conversations ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- 4. Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for departments
CREATE POLICY "Super admins can manage all departments"
  ON public.departments FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Inbox users can view departments"
  ON public.departments FOR SELECT
  USING (has_inbox_access(auth.uid(), inbox_id));

-- 6. RLS policies for department_members
CREATE POLICY "Super admins can manage all department members"
  ON public.department_members FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Inbox users can view department members"
  ON public.department_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_members.department_id
        AND has_inbox_access(auth.uid(), d.inbox_id)
    )
  );

-- 7. Trigger to update updated_at on departments
CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Function to ensure only one default department per inbox
CREATE OR REPLACE FUNCTION public.ensure_single_default_department()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.departments
    SET is_default = false
    WHERE inbox_id = NEW.inbox_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_single_default_department
  BEFORE INSERT OR UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_department();
