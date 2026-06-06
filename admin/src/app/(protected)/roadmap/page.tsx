import type { Metadata } from "next"
import { Kanban } from "@/components/Kanban"
export const metadata: Metadata = { title: "Roadmap" }
export default function RoadmapPage() { return <Kanban /> }
