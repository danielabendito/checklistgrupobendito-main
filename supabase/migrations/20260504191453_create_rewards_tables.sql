-- Create reward_settings table
CREATE TABLE IF NOT EXISTS public.reward_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    photo_url TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(store_id, type)
);

-- Enable RLS
ALTER TABLE public.reward_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for reward_settings
CREATE POLICY "Admins can manage reward settings" ON public.reward_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid() 
            AND ur.store_id = reward_settings.store_id
            AND (r.name = 'admin' OR r.name = 'super_admin')
        )
    );

CREATE POLICY "Users can read reward settings for their store" ON public.reward_settings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.store_id = reward_settings.store_id
        )
    );

-- Create rewards table (granted rewards)
CREATE TABLE IF NOT EXISTS public.rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable RLS
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- Create policies for rewards
CREATE POLICY "Users can insert their own rewards" ON public.rewards
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read their own rewards" ON public.rewards
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Admins can read all rewards" ON public.rewards
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid() 
            AND ur.store_id = rewards.store_id
            AND (r.name = 'admin' OR r.name = 'super_admin')
        )
    );
