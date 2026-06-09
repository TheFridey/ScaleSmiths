# ScaleSmiths — Claude Code & Codex Enhancement Prompts

These are ready-to-paste prompts for Claude Code (or Codex) to progressively
enhance the site. Run them in order for best results. Each is self-contained
and references the actual file paths in this project.

---

## PROMPT 1 — Lenis Smooth Scroll + Scroll Progress Bar

```
In web/src/app/layout.tsx, add Lenis smooth scroll and a top-of-page scroll
progress bar.

Steps:
1. Install: npm install @studio-freight/lenis
2. Create web/src/components/SmoothScroll.tsx as a client component that:
   - Initialises Lenis in a useEffect with duration:1.2, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t))
   - Integrates with Framer Motion's useScroll by calling lenis.on('scroll', ScrollTrigger.update)
   - Cleans up on unmount
3. Create web/src/components/ScrollProgress.tsx — a fixed top bar (height 2px,
   z-index 200, color var(--acc)) that expands from 0% to 100% width using
   Framer Motion's useScroll + useSpring with { stiffness:100, damping:30 }
4. Wrap the layout body children with <SmoothScroll> and add <ScrollProgress />
   at the top of the body.
```

---

## PROMPT 2 — GSAP ScrollTrigger Scroll Reveals

```
Add GSAP ScrollTrigger scroll animations to web/src/components/AnimateIn.tsx.

Current behaviour: uses Framer Motion useInView.
Target behaviour: keep Framer Motion as fallback but add a GSAP version for
richer stagger effects.

1. Install: npm install gsap
2. Create web/src/components/GSAPReveal.tsx as a client component that:
   - Accepts children, className, stagger (default 0.08), y (default 24), delay (default 0)
   - In useEffect, registers ScrollTrigger with gsap.registerPlugin(ScrollTrigger)
   - Animates immediate children from { opacity:0, y } to { opacity:1, y:0 }
     using gsap.fromTo with scrollTrigger: { trigger:ref.current, start:"top 85%", toggleActions:"play none none none" }
   - Cleans up with ctx.revert() on unmount
3. Export GSAPReveal from web/src/components/AnimateIn.tsx alongside existing AnimateIn
4. Use GSAPReveal in web/src/components/Services.tsx for the three service cards
   (stagger:0.1) and in Portfolio.tsx for the project grid (stagger:0.08)
```

---

## PROMPT 3 — Hero GSAP Text Split Animation

```
Enhance web/src/components/Hero.tsx with GSAP character-split animation on
the two headline lines.

Important: the current CSS animation (slide-up) fires immediately before JS
loads — keep it as the initial render. Override it with GSAP once loaded.

1. Convert Hero.tsx to a client component ("use client")
2. Install gsap if not already installed
3. In a useLayoutEffect (not useEffect, to avoid flash):
   - Import gsap and SplitText (or use a manual character split since
     SplitText requires a paid licence — split manually with .split(""))
   - Target the two .hero-h elements
   - Wrap each character in a <span style={{display:"inline-block"}}>
   - Animate with gsap.from(chars, {
       y: "105%", opacity: 0, duration: 0.7, stagger: 0.03,
       ease: "power3.out", delay: 0.15
     }) on the first line, delay 0.3 on the second
   - Remove the CSS animation-delay from hero-line-1 and hero-line-2 once GSAP takes over
4. Add a magnetic hover effect to the two CTA buttons:
   - On mousemove, translate the button slightly toward the cursor (max 8px)
   - On mouseleave, spring back to 0 using gsap.to with elastic ease
```

---

## PROMPT 4 — Page Transitions with Framer Motion

```
Add animated page transitions to web/src/app/layout.tsx.

1. Create web/src/components/PageTransition.tsx as a client component:
   - Use usePathname() to detect route changes
   - Wrap children in <AnimatePresence mode="wait">
   - Each page: initial={{ opacity:0, y:8 }}, animate={{ opacity:1, y:0 }},
     exit={{ opacity:0, y:-8 }}, transition={{ duration:0.28, ease:[0.22,1,0.36,1] }}
   - Use a key equal to the current pathname
2. Wrap the <main id="main"> in layout.tsx with <PageTransition>
3. Add a subtle page-leave overlay: a fixed div that covers the screen during
   exit transitions (opacity 0→0.15→0, color var(--bg), z-index 90)
```

---

## PROMPT 5 — Custom Cursor

```
Add a custom cursor to web/src/components/Cursor.tsx.

1. Create the component ("use client"):
   - A small dot (8px, var(--acc), border-radius 50%) that follows the cursor exactly
   - A larger ring (36px, border 1.5px solid rgba(37,99,235,0.4)) that follows
     with a 60ms lag using requestAnimationFrame + linear interpolation (lerp factor 0.12)
   - Hide the default cursor with CSS: html { cursor: none }
   - On hovering interactive elements (a, button, [role="button"]):
     scale the ring to 1.8 and change dot opacity to 0
   - On hover of .card-lift elements: scale ring to 2.2, rotate 45deg
2. Add <Cursor /> at the top of the body in layout.tsx
3. Only render on non-touch devices: check !window.matchMedia("(pointer:coarse)").matches
```

---

## PROMPT 6 — Project Page Image Mockups

```
Add a device mockup / screenshot section to web/src/app/work/[slug]/page.tsx.

For now, create a visually rich placeholder that represents the project's
aesthetic using CSS gradients and the project's accentColor.

1. After the tag strip and before the body grid, add a full-width "showcase"
   block:
   - A 16:9 aspect ratio container with rounded-2xl, overflow-hidden
   - Background: a CSS mesh gradient using the project's accentColor at low opacity
   - Overlaid with the project name in large Syne text (opacity 0.06)
   - Three "screen" UI elements (fake browser chrome, stat cards) rendered
     as CSS shapes to suggest the project's complexity
   - Style: bg-s1 border border-b1 with gradient overlay at top using accentColor

2. When real screenshots are available, accept a screenshots?: string[] field
   in the Project interface and render them with next/image instead.
   The placeholder shows when screenshots is undefined or empty.
```

---

## PROMPT 7 — Contact Form with Resend

```
Add a working contact/quote form backend to web/src/app/api/quote/route.ts.

1. Install: npm install resend
2. Create web/src/app/api/quote/route.ts:
   - POST handler that accepts { name, email, biz, type, budget, brief }
   - Validates required fields (name, email, brief)
   - Sends two emails via Resend:
     a. Internal notification to RESEND_FROM (you) with all form data formatted cleanly
     b. Auto-reply to the submitter: "You're on our radar" with a clean HTML template
   - Returns { ok: true } on success, { error } on failure
3. Update web/src/app/quote/page.tsx to POST to /api/quote on final submit
   instead of just setting done=true locally
4. Add proper error handling: show the error message if the API call fails
5. Rate-limit: add a simple in-memory rate limiter (1 submission per IP per 10 minutes)
   using a Map<string, number> stored in a module-level variable
```

---

## PROMPT 8 — Auth.js Multi-User Admin

```
Replace the simple cookie auth in admin/ with Auth.js v5 (next-auth@5) for
proper multi-user support.

1. Install: npm install next-auth@5 @auth/core
2. Create admin/auth.ts:
   - Configure Auth.js with Credentials provider
   - Users stored as an array in auth.ts for now (upgrade to DB later):
     [{ id:"1", email: process.env.ADMIN_EMAIL, name:"Rhys" }]
   - Password comparison using bcrypt
   - Session strategy: "jwt", maxAge: 8 * 60 * 60
3. Create admin/app/api/auth/[...nextauth]/route.ts:
   - Export GET and POST handlers from auth.ts
4. Replace admin/src/middleware.ts:
   - Use auth() from Auth.js to protect all routes except /api/auth/*
5. Update admin/src/app/login/page.tsx:
   - Use signIn("credentials", { email, password, redirectTo: "/dashboard" })
6. Update the logout button in admin/src/app/dashboard/layout.tsx:
   - Use signOut({ redirectTo: "/login" })
7. Remove admin/src/app/api/auth/login/route.ts and logout/route.ts
```

---

## PROMPT 9 — Database Integration (Drizzle + PostgreSQL)

```
Add Drizzle ORM to both apps so quote requests, client data, and project
updates are persisted in the PostgreSQL container.

1. Install in both web/ and admin/:
   npm install drizzle-orm pg
   npm install -D drizzle-kit @types/pg

2. Create web/src/lib/db.ts:
   - Connect to DATABASE_URL using drizzle(pg.Pool)
   - Export db instance

3. Create web/src/lib/schema.ts with tables:
   - quote_requests: id, name, email, business, project_type, budget, brief,
     created_at, status (enum: new|read|replied)
   - No other tables needed for the public site

4. Create admin/src/lib/db.ts and admin/src/lib/schema.ts:
   - clients: id, name, contact_name, contact_email, tier, mrr, status, progress,
     created_at, updated_at
   - kanban_cards: id, title, client_id, column (backlog|progress|review|done),
     priority, tag, position, created_at
   - messages: id, client_id, content, direction (inbound|outbound),
     created_at, read_at

5. Create a drizzle.config.ts in each app:
   - pointing to schema.ts, output to drizzle/, dialect "postgresql"

6. Add npm scripts:
   "db:generate": "drizzle-kit generate"
   "db:migrate": "drizzle-kit migrate"
   "db:studio": "drizzle-kit studio"

7. Update web/src/app/api/quote/route.ts to INSERT into quote_requests

8. Update admin/src/app/dashboard/page.tsx to query real MRR from clients table

9. Update admin/src/components/Kanban.tsx to:
   - Load cards from /api/kanban on mount
   - PATCH /api/kanban/[id] when a card is dropped in a new column
```

---

## PROMPT 10 — Client Portal (Phase 2)

```
Add a client-facing portal to the web app at /portal.

1. Create web/src/app/portal/layout.tsx:
   - Separate auth for clients (different from admin)
   - Check for ss-client-session cookie
   - Redirect to /portal/login if not set

2. Create web/src/app/portal/login/page.tsx:
   - Simple email + magic-link or password login for clients
   - For MVP: hardcoded demo login (email: demo@pinkys.com, password: demo)

3. Create web/src/app/portal/[clientId]/page.tsx:
   - Overview tab: project progress, next delivery, recent activity
   - Board tab: read-only kanban (query from admin DB or hardcoded data)
   - Files tab: list of uploaded files from Cloudflare R2
   - Messages tab: threaded comms between client and ScaleSmiths team

4. Create web/src/components/portal/PortalNav.tsx:
   - Sidebar matching the existing dark design system
   - Shows ScaleSmiths logo + client business name
   - Links to the four tabs
   - Retainer tier + price at bottom

5. Style to match: same CSS custom properties as the public site,
   same font system, same border/surface tokens.
```

---

## PROMPT 11 — Performance: Image Pipeline

```
Add a proper image optimisation pipeline to the web app.

1. In web/next.config.ts, configure:
   - images.formats: ["image/avif", "image/webp"]
   - images.deviceSizes: [640, 750, 828, 1080, 1200, 1920]
   - images.minimumCacheTTL: 60 * 60 * 24 * 365

2. Create web/public/images/ directory structure:
   projects/glow-tanning/hero.jpg, thumb.jpg
   projects/pinkys-prints/hero.jpg, thumb.jpg
   etc.

3. Update web/src/lib/data.ts:
   - Add heroImage?: string and thumbImage?: string to Project interface

4. Update web/src/app/work/[slug]/page.tsx:
   - Replace the CSS placeholder showcase with next/image when heroImage is set
   - Add openGraph.images: [{ url: p.heroImage }] to generateMetadata

5. Update web/src/components/Portfolio.tsx:
   - Show thumbImage with next/image (priority on first two cards)
   - Maintain the CSS gradient fallback when no image is set

6. Add a blur placeholder: generate base64 blur hashes for each image using
   plaiceholder and store in data.ts as blurDataURL
```

---

## PROMPT 12 — GSAP Horizontal Scroll Section

```
Add a horizontal scroll section to the homepage that showcases the tech stack
ScaleSmiths works with.

1. After the Testimonials section in web/src/app/page.tsx, add:
   <TechStack />

2. Create web/src/components/TechStack.tsx as a client component:
   - A full-width section with horizontal scroll triggered by vertical scroll
   - Use GSAP + ScrollTrigger with a horizontal pin:
     gsap.to(wrapper, { xPercent:-100 * (panels.length - 1), ease:"none",
       scrollTrigger: { trigger:container, pin:true, scrub:1, snap:1/(panels.length-1) }
     })
   - Tech panels: Next.js, React, Node.js, PostgreSQL, Docker, Stripe, Cloudflare
   - Each panel: full viewport width, dark bg with coloured accent, tech name
     in large Syne font, brief description of how ScaleSmiths uses it
   - Mobile fallback: horizontal scroll snap with CSS (no GSAP)
```

---

## Audit reminders (apply before launch)

- [ ] Replace all `TODO` placeholder content in data.ts
- [ ] Add real OG image at web/public/og.png (1200×630)
- [ ] Set up Google Business Profile (Hucknall, NG15, "Web Design Company")
- [ ] Add real testimonial photos (or avatars) to Testimonials component
- [ ] Add Google Analytics or Plausible: `npm install @next/third-parties`
- [ ] Set up Resend domain verification for email sending
- [ ] Add cookie consent banner (if targeting EU users: yes, you need it)
- [ ] Lock admin IP in nginx.conf before going live (uncomment allow/deny lines)
- [ ] Run Lighthouse audit: `npx lighthouse https://scalesmiths.co.uk --view`
- [ ] Add .well-known/security.txt
