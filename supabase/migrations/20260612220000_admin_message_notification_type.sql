-- GLO-56: one-off admin → customer pushes from the Customer 360 page.
-- Renders admin-typed copy verbatim (the credit_granted {{title}}/{{body}}
-- pattern) so god mode can say anything without a deploy. Sends go through
-- sendNotification() — the registry's one door — and are audit-logged
-- (action: customer.push_sent).
INSERT INTO public.notification_types
  (key, label, description, enabled, delay_minutes, title_template, body_template, thread_id)
VALUES
  ('admin_message', 'Admin message',
   'One-off push to a single customer, written by an admin from the Customer 360 page.',
   true, 0,
   '{{title}}',
   '{{body}}',
   'gloe')
ON CONFLICT (key) DO NOTHING;
