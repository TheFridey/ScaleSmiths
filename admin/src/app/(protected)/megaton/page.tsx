import type { Metadata } from "next";
import { guardPageCapability } from "@/lib/server/rbac";
import { MegatonWorkspace } from "@/components/megaton/MegatonWorkspace";
export const metadata: Metadata = { title: "Megaton · Acquisition workspace" };
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardPageCapability("megaton.read");
  return <MegatonWorkspace />;
}
