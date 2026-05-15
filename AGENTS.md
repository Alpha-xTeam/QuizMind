# QuizMind - Project Rules

## Tech Stack
- Frontend: Vanilla HTML, CSS, JavaScript (no frameworks)
- Backend: Netlify Serverless Functions (Node.js, ES Modules, esbuild)
- Database: Supabase (PostgreSQL, client-side via supabase-js CDN)
- AI: Mistral AI API (server-side only)
- Auth: Supabase Auth (anon key + RLS)
- Hosting: Netlify

## Code Style
- All UI text in Arabic (RTL) unless user requests English
- Use `const` over `let`, avoid `var`
- No comments in code unless explaining a complex workaround
- Use async/await over .then()
- CSS variables for theming (dark/light)
- No external CSS frameworks (Tailwind, Bootstrap, etc.)

## Supabase Rules
- Use Supabase JS client (CDN) directly in the browser — no proxy functions
- Anon key is public by design; security comes from RLS policies
- Every table MUST have RLS enabled with proper policies
- Never expose SERVICE_ROLE_KEY to the client
- Use Supabase JS client methods (`.from().select().eq()`) not raw fetch to REST API

## Security
- API keys go in `.env` (excluded by .gitignore) and Netlify Environment Variables
- Serverless functions validate inputs server-side (length, type, range)
- Rate limiting on public endpoints via Supabase rate_limits table
- CORS restricted to known origins
- Service role key only used in serverless functions, never in client code

## Netlify
- Functions directory: `netlify/functions/`
- Publish directory: `src/`
- Functions use `node_bundler = "esbuild"`
- Redirect `/api/*` to `/.netlify/functions/:splat`
- Use imports from Node built-ins (`crypto`) not npm packages

## UI/UX
- Dark theme default, light theme toggle
- Glassmorphism + subtle borders + rounded corners
- Smooth animations via CSS transitions/transforms
- Responsive: mobile-first breakpoint at 768px
- Minimalist — less is more

## Database Migrations
- Use `supabase_apply_migration` tool for all DDL changes
- Always enable RLS on new tables
- Name migrations descriptively in snake_case
