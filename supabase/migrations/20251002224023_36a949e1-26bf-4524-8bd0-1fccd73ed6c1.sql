-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM (
  'garcom',
  'garconete',
  'atendente',
  'lider',
  'cozinheiro',
  'cozinheiro_lider',
  'auxiliar_cozinha',
  'barman',
  'lider_bar',
  'admin'
);

-- Create enum for checklist status
CREATE TYPE public.checklist_status AS ENUM ('ok', 'nok', 'pendente');

-- Create enum for checklist area
CREATE TYPE public.checklist_area AS ENUM ('loja', 'cozinha', 'bar');

-- Create enum for shift type
CREATE TYPE public.shift_type AS ENUM ('abertura', 'fechamento');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create trigger for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'garcom')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create checklist types table
CREATE TABLE public.checklist_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  area checklist_area NOT NULL,
  turno shift_type NOT NULL,
  allowed_roles user_role[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on checklist_types
ALTER TABLE public.checklist_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view checklist types"
  ON public.checklist_types FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage checklist types"
  ON public.checklist_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create checklist items table
CREATE TABLE public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_type_id UUID NOT NULL REFERENCES public.checklist_types(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on checklist_items
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view checklist items"
  ON public.checklist_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage checklist items"
  ON public.checklist_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create checklist responses table
CREATE TABLE public.checklist_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  checklist_type_id UUID NOT NULL REFERENCES public.checklist_types(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  status checklist_status NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(checklist_item_id, user_id, data)
);

-- Enable RLS on checklist_responses
ALTER TABLE public.checklist_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own responses"
  ON public.checklist_responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own responses"
  ON public.checklist_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses for today"
  ON public.checklist_responses FOR UPDATE
  USING (auth.uid() = user_id AND data = CURRENT_DATE);

CREATE POLICY "Admins can view all responses"
  ON public.checklist_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert default checklist types
INSERT INTO public.checklist_types (nome, area, turno, allowed_roles) VALUES
  ('Abertura Loja', 'loja', 'abertura', ARRAY['garcom', 'garconete', 'atendente', 'lider']::user_role[]),
  ('Fechamento Loja', 'loja', 'fechamento', ARRAY['garcom', 'garconete', 'atendente', 'lider']::user_role[]),
  ('Abertura Cozinha', 'cozinha', 'abertura', ARRAY['cozinheiro', 'cozinheiro_lider', 'auxiliar_cozinha']::user_role[]),
  ('Fechamento Cozinha', 'cozinha', 'fechamento', ARRAY['cozinheiro', 'cozinheiro_lider', 'auxiliar_cozinha']::user_role[]),
  ('Abertura Bar', 'bar', 'abertura', ARRAY['barman', 'lider_bar', 'lider']::user_role[]),
  ('Fechamento Bar', 'bar', 'fechamento', ARRAY['barman', 'lider_bar', 'lider']::user_role[]);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();