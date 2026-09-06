# Chat handoff — Student side complete (Sep 2026)

Paste this into the next Cursor chat to continue. Project: **Sakanat** (`c:\Users\2026\Desktop\sakanat`), Expo SDK **57**, Expo Go.

Prior handoffs: `docs/chat-handoff-trust-verify.md` · transcript [student polish session](c4e999a6-52fc-4c0b-96a7-9981a49948f3)

**Student / seeker account work is done.** Next focus: **owner** (then admin).

---

## Product context

Student housing marketplace (EN/AR). Roles: student, renter, owner, admin. Supabase auth/DB/storage.

Do not: re-add free WhatsApp/phone OTP; change university ID back to digits-only (any chars, **8–10**); put long trust-field hints back unless asked.

---

## SQL to run (order)

1. `supabase/student-trust.sql`
2. `supabase/id-verification.sql`
3. `supabase/student-settings.sql` — prefs, privacy, notify flags, `app_reports`
4. `supabase/chat-inbox.sql` — mute / archive columns
5. `supabase/booking-student-gates.sql` **or** at least `booking-one-active.sql` if gates already applied
6. `supabase/national-id-checksum.sql` — Palestinian/Israeli ID check digit (also folded into booking-student-gates)
7. `supabase/student-profile-extras.sql` — bio, lease/grad, languages, ID expiry/consent, recovery, devices, blocks

---

## What shipped on student / seeker

| Area | Notes |
|------|--------|
| Profile densify | You / Verify / Settings / Saved / Security — compact fields ~40px |
| Settings | Privacy (auto-save toggles), housing prefs, notify categories, in-app reports |
| Privacy wiring | Owner Call/WhatsApp via `canShowSeekerContact`; hide saved count / last-seen IP |
| Messages | Dense inbox, search, Inbox/Unread/Archived, mute/archive, muted = no push |
| One active stay | Server + client gate `BOOKING_ACTIVE_STAY` |
| Search | Amenity multi-filter, denser filters, sort by rating |
| Hamburger | Dense menu; Chats / bookings / saved / settings / security; report form with details |
| National ID checksum | PS/IL Luhn-style check digit on save + booking gate |
| Download my data | Security tab → CSV + summary image |

---

## Suggested next (owner)

1. Owner profile Verify-style tab (ID / business trust mirror of student Verify)
2. Owner listing + booking UX polish (same density language)
3. Admin: `app_reports` queue + ID verify checklist already live — finish reports triage

Optional later: map / near-me, public profile preview, bulk CSV from users list.

---

## Key files

- Menu: `components/menu/AppMenu.tsx`
- Student profile: `app/(student)/(tabs)/profile.tsx`, `components/profile/*`
- Settings SQL: `supabase/student-settings.sql`
- Chat: `components/chat/*`, `supabase/chat-inbox.sql`
- Booking gates: `supabase/booking-student-gates.sql`
- Search: `app/(student)/(tabs)/search.tsx`
