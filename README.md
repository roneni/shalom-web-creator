# AI Pulse

A Hebrew-language AI news and curation platform. AI Pulse aggregates, filters, and presents the most important developments in artificial intelligence -- written natively in Hebrew, not translated.

**Live site:** [shalom-web-creator.vercel.app](https://shalom-web-creator.vercel.app)

## What It Does

AI Pulse is a content hub organized into four editorial sections:

- **Weekly Roundup** -- A curated summary of the most significant AI developments each week
- **New Features** -- Deep dives into newly released features and capabilities across AI products
- **Tool Spotlight** -- One AI tool per week, explained with practical use cases
- **Viral** -- What went viral in the AI world and why it matters

The site includes a newsletter signup flow, an admin panel with a Discovery Engine for targeted content scanning, and a content suggestions pipeline backed by Supabase edge functions.

## Features

- Dark-themed editorial design with RTL-first layout
- Content sections with individual post pages and related post navigation
- Admin dashboard with source management, content suggestions, and a multi-tier Discovery Engine (domains, subfields, ecosystem targets)
- Supabase backend with edge functions for content fetching, processing, search, and trending topic discovery
- Newsletter subscription system
- Social sharing buttons
- WCAG AA-compliant contrast ratios
- Responsive design (mobile through desktop)

## Tech Stack

| Layer       | Technology                                                    |
|-------------|---------------------------------------------------------------|
| Framework   | React 18 with TypeScript                                      |
| Build       | Vite                                                          |
| Routing     | React Router v6                                               |
| Styling     | Tailwind CSS 3 with `tailwindcss-animate`                     |
| Components  | Radix UI primitives via shadcn/ui                             |
| State       | TanStack React Query                                          |
| Backend     | Supabase (database, auth, edge functions)                     |
| Forms       | React Hook Form with Zod validation                           |
| Charts      | Recharts                                                      |
| Testing     | Vitest with Testing Library                                   |
| Deployment  | Vercel                                                        |

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- A Supabase project (for backend functionality)

### Installation

```bash
git clone https://github.com/roneni/shalom-web-creator.git
cd shalom-web-creator
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Testing

```bash
npm run test
```

## Project Structure

```
src/
  components/
    admin/        -- Admin dashboard (login, sources, discovery, suggestions)
    home/         -- Homepage sections (hero, hot now, section cards, newsletter CTA)
    layout/       -- Navbar and footer
    newsletter/   -- Email subscription form
    sections/     -- Post card components
    ui/           -- shadcn/ui component library
  data/           -- Section definitions, mock content, discovery tree
  hooks/          -- Custom hooks (posts, admin, toast, mobile detection)
  integrations/   -- Supabase client and generated types
  lib/            -- Utilities and admin API layer
  pages/          -- Route-level page components
supabase/
  functions/      -- Edge functions (content fetch, processing, search, trending)
  migrations/     -- Database schema migrations
```

## License

All rights reserved.
