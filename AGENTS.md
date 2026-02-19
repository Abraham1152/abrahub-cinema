# context: ABRAhub Cinema - Strategic Engineering

## 🎯 Project Overview
**ABRAhub Cinema** is a high-end AI-driven cinematic generation platform. It migrated from Lovable to a custom infrastructure using **Supabase** (Backend/DB) and **GitHub Pages** (Frontend/Deploy). 

## 🏗️ Technical Architecture
- **Framework:** React + TypeScript + Vite.
- **Backend:** Supabase (Project ID: `vajxjtrztwfolhnkewnq`).
- **Deployment:** 
  - **Production:** GitHub Pages (`main` branch) - [abraham1152.github.io/abrahub-cinema/](https://abraham1152.github.io/abrahub-cinema/)
- **Desktop Version:** Electron-ready (configured for `.EXE` generation via `npm run dist`).

## 💳 Subscription & Access Model (Current)
We operate with three distinct paid tiers. Access is restricted via a whitelist (`authorized_users` table).

1.  **ABRAhub Comunidade:** 
    - **Price IDs:** `price_1SrPOpLkjsnhi7Nmn6nCZYeW`, `price_1SrPtuLkjsnhi7NmaKqqGaCP`.
    - **Benefits:** Unlimited credits (`999999`), BYOK support, all presets.
2.  **ABRAhub PRO:** 
    - **Price IDs:** `price_1T0NjwLkjsnhi7Nm5tPY8H6G`, `price_1SxssfLkjsnhi7NmVsXsSLum`.
    - **Benefits:** 10 monthly credits, BYOK support.
3.  **ABRAhub PRO+:**
    - **Price IDs:** `price_1SrdgbLkjsnhi7Nm3KkX5EVz`, `price_1SrdgpLkjsnhi7NmVbUPjIPj`.
    - **Benefits:** 100 monthly credits, BYOK support, full cinematic quality.

## ⚙️ Core Logic & Configurations
- **Base Path:** Vite is strictly configured with `base: "./"` for GitHub Pages compatibility.
- **BYOK (Bring Your Own Key):** All paid tiers have access to use their own **Google Gemini API Key** via the Settings Modal.
- **Webhooks:** 
  - **Stripe:** Handles independent and Circle-tier subscriptions.
  - **Kiwify:** Integration for external sales. URL: `https://vajxjtrztwfolhnkewnq.supabase.co/functions/v1/kiwify-webhook`.
- **Onboarding:** Specialized modal inviting new paid users to set up their Gemini Key.

## 🛠️ Recent Milestones
- **Critical Stability:** Fixed "white screen" issue by locking `base: "./"` in `vite.config.ts`.
- **Storyboard Cleanup:** Removed "Continuação" button from nodes.
- **Tier Simplification:** System now exclusively supports Community, PRO, and PRO+ tiers.
- **Webhook Validation:** Kiwify verified; Stripe ready for LIVE events.
- **Onboarding Fix:** Eliminated UI "flash" during page refresh.

## 🚀 Vision for the Future
- **Local Storage Management:** Files are kept for 7 days to optimize storage costs.
- **Desktop Integration:** Seamless `.EXE` experience via Electron.
- **Cinema Presets:** Full integration of real lens and camera presets.

---
*This context should be used by any agent to maintain absolute continuity and proactive engineering standards.*
