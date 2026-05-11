---
name: MFA & CAPTCHA implementation
description: TOTP MFA via supabase.auth.mfa.* and Cloudflare Turnstile CAPTCHA on signup/login/password-reset
type: feature
---
**MFA (TOTP)**: Optional for all users. Enrollment UI in `src/components/auth/MFASetup.tsx` (Profile → Settings tab). Login challenge in `src/components/auth/MFAChallenge.tsx`, triggered from `Auth.tsx` after password login when `mfa.getAuthenticatorAssuranceLevel()` returns `nextLevel: aal2`. Uses Supabase native `supabase.auth.mfa.{enroll,challenge,verify,unenroll,listFactors}`.

**SMS/Phone MFA**: Scaffolded but NOT active. Requires Supabase Phone provider (Twilio etc.) to be enabled in dashboard first. When enabled, add a sibling `factorType: 'phone'` flow in MFASetup.

**CAPTCHA**: Cloudflare Turnstile via `@marsidev/react-turnstile`. Site key in `VITE_TURNSTILE_SITE_KEY`. Secret stored in Supabase Auth → Attack Protection (server-side validation). Widget component: `src/components/auth/TurnstileWidget.tsx`. Required on: Auth signup form, Auth signin form, ResetPassword email form. Token passed via `options.captchaToken` to signUp / signInWithPassword / resetPasswordForEmail. Widget remounts (via `key` prop) on error to issue a fresh token.

**Why**: Closes both A07 gaps — MFA option for users + bot defense on auth endpoints.
