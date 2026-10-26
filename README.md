# Curbside Homes

Drive past a home for sale and get a notification with its asking price. Tap it to open the listing.

- `mobile/`: the iPhone and Android app (Expo, React Native, TypeScript)
- `supabase/`: the listings database and the job that syncs listings from RentCast

## How it works

1. You turn on **Drive mode**. The app tracks your location in the background (Android shows a persistent "Drive mode on" notification; iPhone shows the blue location indicator).
2. The app downloads active listings within 3 km from the backend and caches them on the phone for 6 hours, or until you've moved 1.5 km.
3. On each location update it looks for listings within 80 m that are **beside** the car (45 to 135 degrees off your heading), so homes far ahead don't fire early.
4. A new match sends one short notification: `For sale: $549,000` / `123 Oak St · 3 bd · 2 ba`. Tapping it opens the address on Zillow.
5. Safety rules: one alert per listing per week, at most one alert every 2 minutes, and everything goes in the **Drive log**. **Save for later** mode sends nothing while moving and one summary after you've been stopped for 2 minutes.

The matching rules live in `mobile/src/lib/matcher.ts` (`MATCH_RULES`) and are covered by tests.

## Run the app on your Android phone

You need Node 20+ and an Android phone. Drive mode uses background location, which Expo Go doesn't support, so you install a development build once.

```bash
cd mobile
npm install
cp .env.example .env.local   # fill in once the backend exists; optional for a first try
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android
```

Install the APK EAS gives you, then run `npx expo start` and open the project from the dev build.

Without a backend, only **test listings** alert. Use "Drop a test listing where I am" on the home screen, drive away, and come back past that spot.

iPhone builds work the same way with `--platform ios` (needs an Apple Developer account, $99/year). Background location has to be tested on a real iPhone; the simulator can't reproduce a drive with the app in the background.

## Set up the backend

1. Create a project at [supabase.com](https://supabase.com) and install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Apply the schema and deploy the sync job:
   ```bash
   supabase link --project-ref YOUR-PROJECT-REF
   supabase db push
   supabase secrets set RENTCAST_API_KEY=... SYNC_SECRET=$(openssl rand -hex 24) SYNC_AREAS='[{"city":"Austin","state":"TX"}]'
   supabase functions deploy sync-rentcast --no-verify-jwt
   ```
3. Run the sync once (`curl -X POST -H "x-sync-secret: $SYNC_SECRET" https://YOUR-PROJECT.supabase.co/functions/v1/sync-rentcast`), then schedule the same call daily with Supabase Cron.
4. Put the project URL and anon key in `mobile/.env.local`.

**RentCast costs:** every request is billed, and one request returns up to 500 listings. A city with 3,000 active listings costs 6 requests per sync, about 180 a month if synced daily. That's beyond the free tier (50/month), so plan on a paid plan. The RentCast key stays in Supabase secrets and never ships in the app, as RentCast's API terms require.

### Listing data for Canada (Halifax launch)

RentCast covers the US only. Canadian listings come from CREA's [DDF](https://www.crea.ca/files/technology/english/DDFR-Policy-and-Rules-February-2024-ENG.pdf), which has stricter rules:

- Only a participating REALTOR® or brokerage (or a company with a CREA partner agreement) can pull the National Shared Pool feed. A technology provider can run the app on their behalf once they opt in.
- Mobile apps are allowed if their sole purpose is advertising DDF listings.
- Each listing must show the "Powered by REALTOR.ca" logo linked to that listing on REALTOR.ca, the listing brokerage name, the MLS®/REALTOR® trademark statement, and the controlling REALTOR®'s name and brokerage logo.
- Data must refresh at least every 24 hours, and listings that are gone must be removed.

The schema already stores a listing `url` (the REALTOR.ca page), and the app opens it on tap. A `sync-ddf` job replaces `sync-rentcast` once a REALTOR® partner gives access.

## Development

```bash
cd mobile
npm test            # matcher and geo unit tests
npm run typecheck
```

## Known limits and next steps

- Drive mode is turned on by hand. Auto-start when you begin driving needs motion detection; the plan is to switch to `react-native-background-geolocation` (paid license for Android release) once the matching is tuned.
- Listing data is RentCast's aggregated feed. A direct MLS (IDX) feed needs a licensed agent or broker.
- The tap-through opens Zillow by address. It doesn't deep-link to a specific listing page.
