# context: ABRAhub Cinema - Strategic Engineering

## 🎯 Project Overview
**ABRAhub Cinema** is a high-end AI-driven cinematic generation platform. It migrated from Lovable to a custom infrastructure using **Supabase** (Backend/DB) and **GitHub/Vercel** (Frontend/Deploy). The platform focuses on a **Local-First Web** model where heavy assets are managed efficiently.

## 🏗️ Technical Architecture
- **Framework:** React + TypeScript + Vite.
- **Backend:** Supabase (Project ID: `vajxjtrztwfolhnkewnq`).
- **Deployment:** 
  - **Production:** GitHub Pages (`main` branch) - [abraham1152.github.io/abrahub-cinema/](https://abraham1152.github.io/abrahub-cinema/)
  - **Staging/Testing:** Vercel (`staging` branch).
- **Desktop Version:** Electron-ready (configured for `.EXE` generation via `npm run dist`).

## 💳 Subscription & Access Model (Current)
We operate with three distinct paid tiers. There is **no FREE/Basic tier** anymore. Access is restricted via a whitelist (`authorized_users` table).

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
- **BYOK (Bring Your Own Key):** All paid tiers (Community, PRO, PRO+) have access to use their own **Google Gemini API Key** via the Settings Modal.
- **Webhooks:** 
  - **Stripe:** Handles independent and Circle-tier subscriptions.
  - **Kiwify:** New integration for external sales. URL: `https://vajxjtrztwfolhnkewnq.supabase.co/functions/v1/kiwify-webhook`. It syncs purchase/refund status with `authorized_users`.
- **Onboarding:** Specialized modal inviting new paid users to set up their Gemini Key.

## 🛠️ Recent Milestones
- **Storyboard Cleanup:** Removed the "Continuação" button from Scene nodes to simplify the UI.
- **Webhook Validation:** 
  - **Kiwify:** 100% Verified.
  - **Stripe:** Configured in LIVE mode.
- **Mass Import Part 2:** Added 100+ additional users.
- **Tier Simplification:** System now exclusively supports Community, PRO, and PRO+ tiers.
- **Stability:** Fixed UI "flash" issues on page refresh.
- **Tier Simplification:** Removed all references to "Free" and "Basic" plans, consolidating into the 3-tier structure (Community, PRO, PRO+).
- **Stability:** Fixed UI "flash" issues on page refresh where the onboarding modal would appear and disappear instantly.
- **Build Integrity:** Local build and TypeScript checks are passing 100%.

## 🚀 Vision for the Future
- **Local Storage Management:** Files are kept for 7 days to optimize storage costs.
- **Desktop Integration:** Further refining the Electron wrapper for a seamless `.EXE` experience.
- **Cinema Presets:** Full integration of real lens and camera presets (Film Look, Focal Length, Angle, etc.).

---
*This context should be used by any agent to maintain absolute continuity and proactive engineering standards.*
