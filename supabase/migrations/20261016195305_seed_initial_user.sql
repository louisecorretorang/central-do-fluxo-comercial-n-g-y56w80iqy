DO $$
DECLARE
  initial_user_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'louise.faraguti@corretorang.com.br') THEN
    initial_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      phone,
      phone_change,
      phone_change_token,
      reauthentication_token
    ) VALUES (
      initial_user_id,
      '00000000-0000-0000-0000-000000000000',
      'louise.faraguti@corretorang.com.br',
      crypt('Skip@Pass', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"name": "Louise Faraguti"}'::jsonb,
      false,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      '',
      '',
      NULL,
      '',
      '',
      ''
    );
  END IF;
END $$;
