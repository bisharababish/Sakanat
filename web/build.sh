#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

URL="${EXPO_PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-}}"
KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}"

if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — writing placeholder config.js"
  cp config.example.js config.js
  exit 0
fi

# Escape for JS single-quoted strings
esc() { printf '%s' "$1" | sed "s/'/\\\\'/g"; }

cat > config.js <<EOF
window.MATRA7 = {
  supabaseUrl: '$(esc "$URL")',
  supabaseAnonKey: '$(esc "$KEY")',
};
EOF

echo "Wrote config.js for admin dashboard"
