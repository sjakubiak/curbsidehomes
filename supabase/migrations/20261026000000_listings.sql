-- For-sale listings synced from RentCast, queried by the app around the car's position.

create extension if not exists postgis with schema extensions;

create table public.listings (
  id text primary key,                 -- RentCast listing id
  address text not null,
  city text,
  state text,
  zip_code text,
  price numeric not null,
  property_type text,
  bedrooms numeric,
  bathrooms numeric,
  sqft integer,
  status text not null default 'Active',
  listed_date timestamptz,
  last_seen_date timestamptz,
  mls_number text,
  location extensions.geography(point, 4326) not null,
  synced_at timestamptz not null default now()
);

create index listings_location_idx on public.listings using gist (location);
create index listings_status_idx on public.listings (status);

-- The app never reads the table directly; it only calls listings_near().
alter table public.listings enable row level security;

create or replace function public.listings_near(lat double precision, lng double precision, radius_m double precision default 3000)
returns table (
  id text,
  address text,
  price numeric,
  lat double precision,
  lng double precision,
  bedrooms numeric,
  bathrooms numeric,
  sqft integer
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    l.id,
    l.address,
    l.price,
    st_y(l.location::geometry) as lat,
    st_x(l.location::geometry) as lng,
    l.bedrooms,
    l.bathrooms,
    l.sqft
  from public.listings l
  where l.status = 'Active'
    and st_dwithin(l.location, st_point(lng, lat, 4326)::geography, least(radius_m, 5000))
  limit 1000;
$$;

revoke all on function public.listings_near from public;
grant execute on function public.listings_near to anon, authenticated;
