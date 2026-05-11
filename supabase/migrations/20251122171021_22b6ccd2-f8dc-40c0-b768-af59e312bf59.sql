-- Add admin role for samsari.app@gmail.com
INSERT INTO public.admin_roles (user_email, role)
VALUES ('samsari.app@gmail.com', 'admin')
ON CONFLICT (user_email) DO NOTHING;