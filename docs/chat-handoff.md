# Sakanat — chat handoff (25 Aug 2026)

Use this file to continue in a **new chat**. Product is **بدك سكن؟ اطلب منا** (do not rename). Expo SDK **54** / Expo Go. Docs: https://docs.expo.dev/versions/v54.0.0/

Workspace: `c:\Users\2026\Desktop\sakanat`  
Git: https://github.com/bisharababish/Sakanat.git  
Do **not** commit or push unless asked. Do **not** commit `.env`.

---

## Product (stable)

Student housing marketplace for Palestine. Arabic-first, English toggle.

**Roles:** student (`.edu` / `.edu.ps` email), apartment owner (admin-created only), admin (`bishara.babish@gmail.com`).

**Payments:** simulated pay now / pay later. Real card payments wait until asked.

**Map:** no in-app map. “Open in maps” uses apartment `lat`/`lng`. Listing pins copy nearest university until the owner drops a real pin.

**RTL:** `useLayout()`. Arabic with `I18nManager.isRTL === false` sets `flipped`. For Arabic: `flexDirection: 'row'`, text `flex: 1, minWidth: 0` + `{ textAlign: 'right', writingDirection: 'rtl' }`. Chip rows: `flexDirection: 'row'` + wrap + `justifyContent: isRtl ? 'flex-end' : 'flex-start'`.

Do **not** use `@react-native-community/datetimepicker` as a custom flow. Do not implement WhatsApp OTP. Do not copy blue Ma’allem UI. Public register is students only.

---

## Done in this chat

### 1. University campus pins (from the user’s Google Maps links)

All 18 campuses are in:

- `src/data/universities.ts`
- `supabase/university-locations.sql`
- `supabase/schema.sql` seed (`on conflict (slug) do update`)

**An-Najah is the old campus** (Old Campus Street 7), not Al-Junaid.

| Slug | Place | lat, lng |
|---|---|---|
| birzeit | Birzeit University | 31.96005, 35.182412 |
| najah | An-Najah **old campus** | 32.220141, 35.24427 |
| alquds | Al-Quds, Abu Dis | 31.75509, 35.26107 |
| aaup | Arab American University | 32.407379, 35.34369 |
| bethlehem-uni | Bethlehem University, Rue des Frères | 31.710581, 35.201778 |
| hebron-uni | Hebron University | 31.550262, 35.093412 |
| ppu | Palestine Polytechnic, Wadi al-Hariya | 31.533628, 35.097976 |
| ptuk | PTUK Kadoorie, Tulkarm | 32.313376, 35.022438 |
| qou-ramallah | QOU Ramallah / Al-Bireh **البالوع** | 31.920057, 35.207602 |
| qou-nablus | QOU Nablus | 32.240153, 35.235398 |
| qou-hebron | QOU Hebron (`G3VM+CV4`) | 31.543513, 35.084703 |
| qou-bethlehem | QOU Beit Jala (`P58R+C6J`) | 31.716088, 35.190516 |
| qou-jenin | QOU Jenin (`F78V+HH5`) | 32.466387, 35.293984 |
| qou-tulkarm | QOU Tulkarm (`829J+2MC`) | 32.317562, 35.031641 |
| istiqlal | Al Istiqlal, Jericho | 31.877345, 35.4569 |
| dar-alkalima | Dar Al-Kalima, Bethlehem | 31.696979, 35.189354 |
| ahliya | Palestine Ahliya, Bethlehem | 31.695506, 35.187508 |
| zaytuna | Al-Zaytuna, Salfit–Lubban road | 32.077514, 35.216369 |

**QOU Ramallah:** Google’s listing text still says a Kenya address. The **pin** is البالوع / البيرة. That is the one we stored.

**Must run** `supabase/university-locations.sql` in the Supabase SQL editor. It also copies campus coords onto existing apartments. Old listings keep stale pins until that runs (this is why Bethlehem looked wrong before).

### 2. Native iOS alerts replaced

`Alert.alert` is gone everywhere. In-app notices:

- Success / error → branded toast at the top (green / red / gold)
- Confirm (logout, delete, hide) → cream modal with app buttons

Files: `src/lib/notice.tsx` (`alert()` drop-in), `NoticeProvider` in `app/_layout.tsx`.

### 3. Hamburger menu + dark mode

**Hamburger** (top right on `Screen`, `AuthScreen`, chat header) opens `AppMenu`:

- Language (ع / EN)
- Appearance: Light / Dark / System
- Push notifications toggle (logged-in only)
- Contact us + Support (mailto `bishara.babish@gmail.com`)
- Logout (in-app confirm)

Profile tab is still for personal data. Language + logout were removed from `ProfileHero`.

**Dark mode:** `ThemeProvider` + `useColors()` in `src/theme/ThemeProvider.tsx`. Palettes in `src/theme/colors.ts`. Preference persisted as `sakanat.theme`. `app.json` `userInterfaceStyle` is `"automatic"`.

Chrome that follows the theme: Screen, buttons, cards, chips, inputs, selects, tabs, notices, listing cards, booking cards, auth brand/card, profile hero, section heads.

Some inner screens (chat thread, search filters, phone field, date field, apartment details copy) may still use leftover light `StyleSheet` colors. If a screen looks wrong in dark mode, paint it with `useColors()`.

---

## SQL the user may still need to run in Supabase

- `supabase/student-only-signup.sql`
- `supabase/university-locations.sql` ← **run this after the pin updates**
- `supabase/admin-crud.sql`
- `supabase/push-token.sql` (optional)

---

## Intentionally not done (side quests)

- Real card payments
- In-app map / owner apartment pin picker
- Owner self-signup
- WhatsApp OTP
- Commit / push unless asked
- Finishing every screen for dark mode (chrome is done; some inner pages may still be light-tinted)

---

## How the app is wired now (for the next chat)

- Notices: `import { alert } from '@/src/lib/notice'` — not `Alert.alert`
- Theme: `useColors()` / `useTheme()` from `@/src/theme/ThemeProvider`
- Menu: `MenuButton` + `MenuProvider` in root layout
- Support email: `src/lib/support.ts` (`SUPPORT_EMAIL`)
- Push pref: `getPushEnabled` / `setPushEnabled` in `src/lib/push.ts`
- Distance chips: `src/lib/distance.ts` (`UNDER_ONE_KM`, `CAMPUS_KM_VALUES`). Auto-distance from a real apartment pin vs campus is still a side quest.

---

## Do not

Rename the app. Reintroduce datetimepicker. Add real payments until asked. WhatsApp OTP. Commit unless asked. Copy blue Ma’allem UI. Re-enable owner self-registration. Treat stacked chips as intended (`flexDirection: 'row'`).
