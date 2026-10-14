import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import assert from "node:assert/strict";

// Isolated component -> production service -> embedded PostgreSQL proof.
// This does not prove Auth.js login, live Mailcow, provider accounts or production deployment.
const directory = path.resolve("test-results/megaton");
await mkdir(directory, { recursive: true });
Object.assign(process.env, {
  MEGATON_ENABLED: "true",
  MEGATON_EXTERNAL_ENABLED: "false",
  MEGATON_SEND_ENABLED: "false",
  MEGATON_STOP: "true",
  MEGATON_AI_ENABLED: "false",
  MEGATON_DISCOVERY_ENABLED: "false",
});
const fixtureModule = `import { PGlite } from '@electric-sql/pglite';import { PgDialect } from 'drizzle-orm/pg-core';
 const pg=new PGlite(),dialect=new PgDialect();const execute=(driver,s)=>{const q=dialect.sqlToQuery(s);return driver.query(q.sql,q.params)};
 export const db={execute:s=>execute(pg,s),transaction:fn=>pg.transaction(tx=>fn({execute:s=>execute(tx,s)}))};
 export async function init(schema){await pg.exec("create table admin_users(id uuid primary key,role text,active boolean,session_version integer,display_name text);create table prospects(id serial primary key,business_name text,contact_email text,website_url text,location text,industry text,source text,stage text default 'found',owner_user_id uuid,archived_at timestamptz,updated_at timestamptz default now());create table commercial_contacts(id serial primary key,prospect_id integer,email text,suppressed boolean default false);");await pg.exec(schema);await pg.exec("insert into admin_users values('00000000-0000-4000-8000-000000000001','owner',true,1,'Rhys fixture'),('00000000-0000-4000-8000-000000000002','venture_controller',true,1,'Trev fixture');");}export const close=()=>pg.close();`;
const backend = await build({
  stdin: {
    contents: `export {megatonSnapshot,megatonMutation} from './src/lib/server/megaton';export {init,close} from '__megaton_fixture_db__';`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  packages: "external",
  plugins: [
    {
      name: "isolated-test-database",
      setup(builder) {
        builder.onResolve(
          { filter: /^(\.\.\/db|__megaton_fixture_db__|server-only)$/ },
          ({ path }) => ({
            path: path === "server-only" ? path : "db",
            namespace: "megaton-fixture",
          }),
        );
        builder.onLoad(
          { filter: /.*/, namespace: "megaton-fixture" },
          ({ path }) => ({
            contents: path === "server-only" ? "" : fixtureModule,
            loader: "ts",
            resolveDir: process.cwd(),
          }),
        );
      },
    },
  ],
});
const backendPath = path.join(directory, "backend.mjs");
await writeFile(backendPath, backend.outputFiles[0].text);
const service = await import(pathToFileURL(backendPath).href);
await service.init(
  ((await readFile("drizzle/0066_megaton_foundation.sql", "utf8")) + '\n' + (await readFile("drizzle/0067_megaton_growth_and_alerts.sql", "utf8"))).replaceAll(
    "--> statement-breakpoint",
    "",
  ),
);
const frontend = await build({
  stdin: {
    contents: `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {MegatonWorkspace} from './src/components/megaton/MegatonWorkspace';import {AdminSidebar,AdminTopBar,MobileSheet,NAV} from './src/components/admin-shell/AdminShell';import {InstallAppProvider} from './src/components/command-centre/InstallAppProvider';function Fixture(){const [mobile,setMobile]=useState(false);return <InstallAppProvider><div className="admin-shell" data-sidebar="expanded"><AdminSidebar collapsed={false} focusMode={false} pathname="/megaton" navigation={NAV} onCollapse={()=>{}} onSignOut={()=>{}}/><AdminTopBar pathname="/megaton" isForge={false} focusMode={false} onOpenNavigation={()=>setMobile(true)} onToggleFocus={()=>{}}/><div className="admin-main"><MegatonWorkspace/></div><MobileSheet open={mobile} title="Navigation" onClose={()=>setMobile(false)}><AdminSidebar collapsed={false} focusMode={false} pathname="/megaton" navigation={NAV} onCollapse={()=>{}} onSignOut={()=>{}}/></MobileSheet></div></InstallAppProvider>}createRoot(document.getElementById('root')).render(<Fixture/>);`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  platform: "browser",
  jsx: "automatic",
  alias: { "@": path.resolve("src") },
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  plugins: [
    {
      name: "fixture-router",
      setup(builder) {
        builder.onResolve(
          { filter: /^(next\/link|next\/navigation|next-auth\/react)$/ },
          ({ path }) => ({ path, namespace: "router" }),
        );
        builder.onLoad({ filter: /.*/, namespace: "router" }, ({ path }) => ({
          contents:
            path === "next/link"
              ? 'import React from "react";export default function Link({children,...props}){return <a {...props}>{children}</a>}'
              : path === "next/navigation"
                ? 'export const usePathname=()=>"/megaton";'
                : "export async function signOut(){}",
          loader: "jsx",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const css =
  (await readFile(path.join(directory, "tailwind.css"), "utf8")) +
  "\n" +
  (await readFile("src/app/globals.css", "utf8"));
const actors = {
  rhys: {
    id: "00000000-0000-4000-8000-000000000001",
    role: "owner",
    sessionVersion: 1,
  },
  trev: {
    id: "00000000-0000-4000-8000-000000000002",
    role: "venture_controller",
    sessionVersion: 1,
  },
};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  try {
    if (url.pathname === "/bundle.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(frontend.outputFiles[0].text);
      return;
    }
    if (url.pathname === "/api/megaton") {
      const actor =
        request.headers["x-fixture-actor"] === "trev"
          ? actors.trev
          : actors.rhys;
      let result;
      if (request.method === "POST") {
        let body = "";
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 30000) throw new Error("Fixture request too large");
        }
        result = await service.megatonMutation(actor, JSON.parse(body));
      } else
        result = await service.megatonSnapshot(
          actor,
          url.searchParams.get("query") || "",
          Number(url.searchParams.get("page") || 1),
        );
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(result));
      return;
    }
    if (url.pathname.startsWith("/brand/")) {
      const filename = path.join("public", url.pathname);
      response.setHeader(
        "Content-Type",
        filename.endsWith(".svg") ? "image/svg+xml" : "image/png",
      );
      response.end(await readFile(filename));
      return;
    }
    response.setHeader("Content-Type", "text/html");
    response.end(
      `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`,
    );
  } catch (error) {
    console.error("Fixture service failure:", error.message);
    response.statusCode = error.status || 500;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ error: error.message }));
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const base = `http://127.0.0.1:${server.address().port}`;
const errors = [];
try {
  const preflight = await fetch(`${base}/api/megaton`);
  const preflightData = await preflight.json();
  assert.equal(
    preflight.status,
    200,
    preflightData.error || "Workspace API ready",
  );
  const first = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    second = await browser.newPage({
      viewport: { width: 390, height: 844 },
      extraHTTPHeaders: { "x-fixture-actor": "trev" },
    });
  for (const page of [first, second])
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error("Browser fixture error:", error.message);
    });
  await first.goto(base);
  await first.getByRole("button", { name: "Discovery", exact: true }).click();
  await first
    .getByLabel("Campaign name", { exact: true })
    .fill("Hucknall plumbing fixture");
  await first.locator('form').filter({has:first.getByRole('button',{name:'Create campaign',exact:true})}).getByLabel("UK town", { exact: true }).fill("Hucknall");
  await first.getByLabel("Industry", { exact: true }).fill("Plumbing");
  await first
    .getByRole("button", { name: "Create campaign", exact: true })
    .click();
  await first
    .getByText("Hucknall plumbing fixture", { exact: true })
    .first()
    .waitFor();
  await first
    .getByLabel("Business name", { exact: true })
    .fill("Local Fixture Ltd");
  await first.getByLabel("Verified UK town", { exact: true }).fill("Hucknall");
  await first
    .getByLabel("Business website", { exact: true })
    .fill("https://example.com");
  await first
    .getByLabel("Public business email (optional)", { exact: true })
    .fill("buyer@example.com");
  await first
    .getByLabel("Discovery source URL", { exact: true })
    .fill("https://example.com/about");
  await first
    .getByLabel("Source permission and location evidence", { exact: true })
    .fill("Synthetic fixture source; not real intelligence");
  await first
    .getByRole("button", { name: "Import into shared pipeline", exact: true })
    .click();
  await first.getByRole("button", { name: "Prospects", exact: true }).click();
  await first.getByRole('button',{name:'Add prospect',exact:true}).click();
  await first.getByLabel('Business name',{exact:true}).fill('Manual fixture business');
  await first.getByLabel('Town / trading location',{exact:true}).fill('Hucknall');
  await first.getByLabel('Industry',{exact:true}).fill('Carpentry');
  await first.getByLabel('Source and verified location evidence',{exact:true}).fill('Synthetic owner-provided fixture');
  await first.getByRole('button',{name:'Save prospect',exact:true}).click();
  await first.getByRole('button',{name:/Manual fixture business/}).waitFor();
  await first.getByRole('button',{name:'Social outreach',exact:true}).click();
  await first.getByLabel('Prospect',{exact:true}).selectOption({label:'Manual fixture business'});
  await first.getByLabel("Prospect's social profile URL",{exact:true}).fill('https://www.linkedin.com/company/example/');
  await first.getByLabel('Recipient permission / eligibility evidence',{exact:true}).fill('Synthetic fixture: explicit request for contact');
  await first.getByLabel('Message for human review',{exact:true}).fill('Synthetic fixture message. Never sent.');
  await first.getByRole('button',{name:'Request approval',exact:true}).click();
  await first.getByText('Synthetic fixture message. Never sent.',{exact:true}).waitFor();
  await first.getByRole('button',{name:'Approve exact message',exact:true}).click();
  await first.getByRole('link',{name:'Open LinkedIn',exact:false}).waitFor();
  await first.screenshot({path:path.join(directory,'desktop-social-approval.png')});
  await first.getByRole("button", { name: "Prospects", exact: true }).click();
  await first.getByRole("button", { name: /Local Fixture Ltd/ }).click();
  await first
    .getByText("Insufficient Evidence", { exact: false })
    .first()
    .waitFor();
  await first.screenshot({
    path: path.join(directory, "desktop-prospects.png"),
  });
  await first
    .getByLabel("Recipient", { exact: true })
    .fill("buyer@example.com");
  await first
    .getByRole("button", { name: "Create draft", exact: true })
    .click();
  await first
    .getByRole("button", { name: "Inbox & approvals", exact: true })
    .click();
  await first.getByRole("button", { name: /buyer@example.com/ }).click();
  await first
    .getByText("Contact eligibility and evidence", { exact: true })
    .click();
  await first
    .getByLabel("Subscriber type", { exact: true })
    .selectOption("corporate");
  await first
    .getByLabel("Lawful basis", { exact: true })
    .selectOption("legitimate_interests");
  await first
    .getByLabel("Consent or corporate eligibility / transparency evidence", {
      exact: true,
    })
    .fill("Synthetic fixture corporate eligibility");
  await first
    .getByRole("button", { name: "Save eligibility", exact: true })
    .click();
  await first
    .getByRole("button", { name: "Approve saved content", exact: true })
    .click();
  const send = first.getByRole("button", {
    name: "Send approved message",
    exact: true,
  });
  await send.waitFor();
  assert.equal(await send.isDisabled(), true);
  await first.screenshot({ path: path.join(directory, "desktop-inbox.png") });
  await second.goto(base);
  await second
    .getByRole("button", { name: "Inbox & approvals", exact: true })
    .click();
  await second.getByRole("button", { name: /buyer@example.com/ }).click();
  await second
    .getByRole("button", { name: "Take ownership", exact: true })
    .click();
  await second.getByText("Owned by you", { exact: false }).waitFor();
  await second.screenshot({ path: path.join(directory, "mobile-inbox.png") });
  await second.getByRole("button", { name: "Operations", exact: true }).click();
  await second
    .getByRole("heading", { name: "Connection & controls", exact: true })
    .waitFor();
  await second.screenshot({
    path: path.join(directory, "mobile-operations.png"),
  });
  for (const page of [first, second])
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      "No horizontal page overflow",
    );
  assert.deepEqual(errors, []);
  console.log(
    "Megaton fixture browser -> production services -> embedded PostgreSQL passed: shared records, approval, disabled send, takeover, mobile layout; no live integrations tested.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await service.close();
}
