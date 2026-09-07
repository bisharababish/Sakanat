# Deploy push-send

From the project root (with Supabase CLI logged in):

```bash
supabase functions deploy push-send
```

The app calls `push-send` first, then falls back to direct Expo Push if the function is missing.
