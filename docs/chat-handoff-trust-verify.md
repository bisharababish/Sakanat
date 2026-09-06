# Chat handoff — Trust, verify, profile (Sep 2026)

Paste this into the next Cursor chat to continue. Project: **Sakanat** (`c:\Users\2026\Desktop\sakanat`), Expo SDK **57**, Expo Go.

Transcript (long history): [trust & profile session](ce71295f-03d2-410f-a977-b97725552f41)

---

## Product context

Student housing marketplace (EN/AR). Roles: student, renter, owner, admin. Supabase auth/DB/storage.

This session focused on **landlord trust / student verification**, profile UX, crashes, and ID privacy.

---

## What was built / changed

### 1. Student trust fields + reviews (SQL)

**File:** `supabase/student-trust.sql`

- Profile columns: `home_address`, `national_id_number`, `national_id_url`, `university_card_url`, `emergency_name`, `emergency_phone`, `last_seen_ip`
- `apartment_reviews` table + `review_avg` / `review_count` on apartments
- Required post-stay reviews (app blocks new booking until review is written)

### 2. Private ID storage + admin verification (SQL) — **must run**

**File:** `supabase/id-verification.sql` ← user had this open

Creates:

- Private storage bucket **`id-docs`** (paths `{userId}/national.ext`, `{userId}/university.ext`)
- Columns: `id_verify_status` (`none` | `pending` | `approved` | `rejected`), `id_verify_note`, `id_verified_at`, `id_verified_by`
- Students may only set status → `pending` (upload); only admin can approve/reject
- Tighter `profiles_read` RLS (self, admin, booking/chat party, approved listing owners)
- Storage RLS: own folder, admin, or owner with a booking on that student

**App wiring:**

- `src/lib/upload.ts` — upload to `id-docs`, `idDocUrl()` uses **signed URLs** (legacy `http` / `docs/` public paths still resolve)
- Upload sets `id_verify_status: 'pending'`
- Admin queue: `app/(admin)/(tabs)/verify.tsx` (hidden tab, linked from overview)
- `components/profile/IdReviewCard.tsx` on admin user detail
- `components/profile/IdVerifyBadge.tsx` on student hero + booking trust lines
- Overview tile: pending ID checks; users tab badge = pending owners + pending IDs

### 3. Student profile organization

Tabs: **You / Verify / Saved / Security**

- Progress chips + jump-to-section
- Trust fields on Verify; studies on You (students)
- Reviews live on **Bookings**, not profile
- Menu: tech vs safety report emails, FAQ, verification row, etc.

### 4. WhatsApp free phone confirm — **removed**

User said free WhatsApp confirm wouldn’t work. Do **not** reintroduce phone OTP / WhatsApp confirm unless asked.

### 5. Profile crash fix (`undefined is not a function`)

Cause: stale Metro / missing imports (`isValidStudentId` / `isValidStudentIdNumber` from trust after phone-confirm cleanup).

Fix: student profile validators inlined / local helpers; later university ID uses `phone.ts` helpers. Cleared Metro with `expo start -c` when needed.

### 6. ID photo crop

`pickIdCardPhoto` in `src/lib/pickImage.ts`: `allowsEditing: true`, aspect `[85, 54]`, fallback if crop fails.

### 7. Profile UI tighten (keep all fields, less bulk)

- Compact hero, progress (max 4 missing chips + `+N`)
- Merged cards (names+about; IDs+emergency)
- Collapsible `OwnerSeenCard`
- Removed recent trust field **hints** under inputs (user request)
- Compact `Card` / `SectionHead` / segments / IdDocField

### 8. University ID rules (final)

**Any characters, length 8–10 only.**

- `sanitizeStudentId` / `isValidStudentId` in `src/lib/phone.ts`
- Normal keyboard (not number-pad)
- Used by student profile, admin user edit, `studentProfile.isStudentReady`

---

## Key files

| Area | Paths |
|------|--------|
| SQL | `supabase/student-trust.sql`, `supabase/id-verification.sql` |
| Upload / signed URLs | `src/lib/upload.ts` |
| Trust helpers | `src/lib/trust.ts` |
| Ready-to-book | `src/lib/studentProfile.ts` |
| University ID | `src/lib/phone.ts` |
| Student profile | `app/(student)/(tabs)/profile.tsx` |
| Account / safety UI | `components/profile/ProfileAccountFields.tsx`, `ProfileSafetyFields.tsx` |
| Admin verify | `app/(admin)/(tabs)/verify.tsx`, `IdReviewCard.tsx` |
| Badge | `components/profile/IdVerifyBadge.tsx`, `ProfileHero.tsx` |
| Image pick | `src/lib/pickImage.ts` |
| i18n | `src/i18n/en.json`, `ar.json` |

---

## Run the app

```bash
cd c:\Users\2026\Desktop\sakanat
npx expo start --port 8081
```

Expo Go / QR. If weird crashes after edits: `npx expo start -c`.

---

## Checklist before shipping trust features

1. [ ] Run `student-trust.sql` in Supabase (if not already)
2. [ ] Run **`id-verification.sql`** in Supabase
3. [ ] Run **`student-settings.sql`** in Supabase (privacy / prefs / reports)
4. [ ] Run **`national-id-checksum.sql`** (or re-run `booking-student-gates.sql`) for ID check digit
5. [ ] Upload national (+ university) ID as student → status pending
6. [ ] Admin Overview / Verify → checklist + approve → badge shows
7. [ ] Owner booking view can open ID cards (signed URL)
8. [ ] Student Settings → privacy hides phone until confirmed / none
9. [ ] Student Security → Download my information; admin user → Export

---

## Intentionally not done / next priorities

| Priority | Item | Notes |
|----------|------|--------|
| High | Confirm SQL ran in prod | User may still need to run `id-verification.sql` |
| High | Server-side booking readiness | Gates are mostly **client-only** today |
| High | Server-side “must review before book” | Same |
| Med | In-app safety reports queue | Mailto only now → **app_reports** in `student-settings.sql` + Settings tab |
| Med | Owner profile mirror (Verify tab style) | Student side done |
| Done | Student Settings tab | Privacy, housing prefs, notify categories, report history |
| Later | SMS phone OTP | Paid; skip unless asked |
| Later | Selfie ↔ ID KYC (Stripe Identity etc.) | Costly |
| Later | Migrate old public `docs/` ID files into `id-docs` | New uploads are private |

---

## Do not

- Re-add free WhatsApp / phone confirmation
- Change university ID back to digits-only (user wants **any chars, 8–10**)
- Put long hint paragraphs back under every trust field unless asked

---

## Security audit snapshot (from this chat)

**Done:** MFA (admin required), email OTP, password rules, idle logout, profile completeness gate, ID upload + emergency + IP, reviews gate (app), suspend/delete, owner sees trust on bookings.

**Partial:** ID docs were public → now private bucket + signed URLs (needs SQL). Profile RLS tightened in same SQL. Admin approve/reject + badge wired.

**Gaps:** Client-only book/review enforcement; no in-app report tickets; no owner ownership-doc flow; no SMS OTP.

---

## Suggested next chat opener

> Continue from docs/chat-handoff-trust-verify.md. Confirm id-verification.sql is run, then [server-side booking gates / in-app reports / owner profile mirror].
