INSERT INTO public.vendors (
  id, business_name, slug, description, address_line1, city, region, postal_code, country,
  location, hours_summary, status, rating_avg, review_count
) VALUES
  (
    '55555555-5555-5555-5555-555555555555',
    'Pacific Beach Aesthetics', 'pb-aesthetics',
    'Beach-vibe med spa for everyday glow. Botox, filler, hydrafacials.',
    '1235 Garnet Ave', 'Pacific Beach', 'CA', '92109', 'US',
    ST_SetSRID(ST_MakePoint(-117.2406, 32.7986), 4326)::geography,
    'Mon-Sun 9am-8pm', 'active', 4.80, 215
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    'Encinitas Glow Co', 'encinitas-glow',
    'Coastal medical aesthetics with a holistic edge.',
    '687 S Coast Hwy 101', 'Encinitas', 'CA', '92024', 'US',
    ST_SetSRID(ST_MakePoint(-117.2920, 33.0370), 4326)::geography,
    'Tue-Sat 10am-6pm', 'active', 4.95, 142
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    'Downtown SD Skin Bar', 'downtown-skinbar',
    'Quick lunch-break facials, peels, and laser in the Gaslamp.',
    '550 Fifth Ave', 'San Diego', 'CA', '92101', 'US',
    ST_SetSRID(ST_MakePoint(-117.1580, 32.7117), 4326)::geography,
    'Mon-Fri 8am-7pm', 'active', 4.60, 78
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    'North Park Body Lab', 'north-park-body-lab',
    'Body sculpting, CoolSculpting, Emsculpt. Tattoo-friendly clinic.',
    '3015 University Ave', 'San Diego', 'CA', '92104', 'US',
    ST_SetSRID(ST_MakePoint(-117.1376, 32.7484), 4326)::geography,
    'Wed-Sun 11am-8pm', 'active', 4.75, 134
  );

-- Providers
INSERT INTO public.providers (vendor_id, name, title, bio, photo_url) VALUES
  ('55555555-5555-5555-5555-555555555555', 'Ava Martinez', 'NP',
    'Surf-town nurse practitioner. Specializes in subtle, natural results for active lifestyles.',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&auto=format&q=80'),
  ('66666666-6666-6666-6666-666666666666', 'Dr. Sasha Klein', 'MD',
    'Dermatologist with a holistic practice in Encinitas. Focused on long-term skin health.',
    'https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=400&h=400&fit=crop&auto=format&q=80'),
  ('77777777-7777-7777-7777-777777777777', 'Priya Sharma', 'PA',
    'Aesthetic PA with 6 years in laser and chemical peel work.',
    'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop&auto=format&q=80'),
  ('88888888-8888-8888-8888-888888888888', 'Marcus Chen', 'RN',
    'Body sculpting specialist. CoolSculpting Master, Emsculpt-certified.',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&auto=format&q=80');

-- Service tags
INSERT INTO public.vendor_services (vendor_id, category_id)
SELECT v.id, c.id FROM public.vendors v, public.service_categories c
WHERE
  (v.slug = 'pb-aesthetics' AND c.slug IN ('botox', 'filler', 'skin'))
  OR (v.slug = 'encinitas-glow' AND c.slug IN ('skin', 'filler', 'wellness'))
  OR (v.slug = 'downtown-skinbar' AND c.slug IN ('skin', 'wellness'))
  OR (v.slug = 'north-park-body-lab' AND c.slug IN ('body', 'skin'));