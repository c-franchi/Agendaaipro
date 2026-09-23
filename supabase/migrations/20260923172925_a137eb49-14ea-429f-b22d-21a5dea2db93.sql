DROP POLICY IF EXISTS "Admins can manage bookings" ON public.bookings;
CREATE POLICY "Admins can read bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

REVOKE INSERT, UPDATE, DELETE ON public.bookings FROM authenticated;
GRANT SELECT ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;