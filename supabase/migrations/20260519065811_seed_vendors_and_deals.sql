INSERT INTO public.vendors (
  id, business_name, slug, description, address_line1, city, region, postal_code, country,
  location, hours_summary, status, rating_avg, review_count
) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Glow Aesthetics La Jolla', 'glow-la-jolla',
    'Premium injectables in the heart of La Jolla. Nurse-led, longevity-focused.',
    '7777 Girard Ave', 'La Jolla', 'CA', '92037', 'US',
    ST_SetSRID(ST_MakePoint(-117.2731, 32.8328), 4326)::geography,
    'Mon-Sat 9am-7pm', 'active', 4.90, 312
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Badia Wellness', 'badia-wellness',
    'Aesthetics + IV wellness in Mission Valley.',
    '4242 Camino Del Rio N', 'San Diego', 'CA', '92108', 'US',
    ST_SetSRID(ST_MakePoint(-117.1283, 32.7785), 4326)::geography,
    'Tue-Sat 10am-6pm', 'active', 4.90, 188
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Skin Studio Hillcrest', 'skin-studio-hillcrest',
    'Skin rejuvenation specialists. Microneedling, PRP, peels.',
    '3845 Fourth Ave', 'San Diego', 'CA', '92103', 'US',
    ST_SetSRID(ST_MakePoint(-117.1611, 32.7494), 4326)::geography,
    'Wed-Sun 11am-7pm', 'active', 4.80, 96
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'NAD Lounge SD', 'nad-lounge-sd',
    'Longevity drip bar. NAD+, peptides, IV wellness in Little Italy.',
    '1234 India St', 'San Diego', 'CA', '92101', 'US',
    ST_SetSRID(ST_MakePoint(-117.1696, 32.7251), 4326)::geography,
    'Daily 9am-8pm', 'active', 4.70, 54
  );

INSERT INTO public.providers (vendor_id, name, title, bio, photo_url) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Madison Reyes', 'NP',
    'Board-certified nurse practitioner with 8+ years in aesthetic injectables.',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&auto=format&q=80'),
  ('22222222-2222-2222-2222-222222222222', 'Dr. Lila Badia', 'MD',
    'Aesthetics physician with a longevity-focused practice. Decorated ICU nurse alumna.',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&auto=format&q=80'),
  ('33333333-3333-3333-3333-333333333333', 'Erin Park', 'RN',
    'Aesthetic RN specializing in skin rejuvenation and collagen induction.',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&auto=format&q=80'),
  ('44444444-4444-4444-4444-444444444444', 'Jordan Kim', 'NP',
    'IV therapy and longevity-medicine NP. Trained at UCSD Health.',
    'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=400&h=400&fit=crop&auto=format&q=80');

INSERT INTO public.vendor_services (vendor_id, category_id)
SELECT v.id, c.id FROM public.vendors v, public.service_categories c
WHERE
  (v.slug = 'glow-la-jolla' AND c.slug IN ('botox', 'filler', 'skin'))
  OR (v.slug = 'badia-wellness' AND c.slug IN ('filler', 'skin', 'wellness'))
  OR (v.slug = 'skin-studio-hillcrest' AND c.slug IN ('skin', 'body'))
  OR (v.slug = 'nad-lounge-sd' AND c.slug IN ('wellness'));