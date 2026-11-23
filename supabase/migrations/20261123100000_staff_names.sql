-- Use the staff’s real names in the UI and reports. “You” is a client-side
-- label for the signed-in person and is never stored.

update public.profiles
set display_name = 'Aldwin'
where employee_id = 'JJA-001';

update public.profiles
set display_name = 'Magma'
where employee_id = 'JJA-002';
