# RunFloor Sales GA4

RunFloor Sales sends web analytics only on the production hosts `runfloorsales.com` and `www.runfloorsales.com`, and only when the configured measurement ID is the expected Sales stream.

## Production configuration

Set `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-8GDCD9C0CQ` for the Vercel `runfloor` project's Production environment, then redeploy. The component rejects other hostnames and measurement IDs, so Vercel previews and local development are excluded.

## Consent and privacy

Analytics runs only after a visitor chooses “Allow analytics.” “Decline” is stored locally. Global Privacy Control and Do Not Track signals suppress both the notice and analytics. No form values, credentials, customer names, email addresses, payment values, or URL query strings are sent to GA4. Conversion events are deduplicated within a browser session.

## Events

The shared GA4 component records page views, pricing views, industry landing views, platform navigation, signup/trial/login/demo clicks, checkout initiation, and upgrade clicks. Confirmed registration, login, trial activation, and subscription purchase events are added only on successful application return paths. Use event names in `data-rf-analytics-event` or dispatch `runfloor:analytics` for application-confirmed events; never attach user data.

## Verification

Use a fresh browser session, opt in to analytics, then check Google Tag Assistant or browser Network for the request to `google-analytics.com/g/collect` and confirm `tid=G-8GDCD9C0CQ`. Declining consent, enabling GPC/DNT, or visiting a preview host should produce no GA request. Check that only one GA4 configuration and one manual page view are emitted per navigation.
