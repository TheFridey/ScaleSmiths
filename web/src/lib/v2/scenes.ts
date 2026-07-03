export type V2Industry =
  | "local-trade-builder"
  | "restaurant-food"
  | "gym-fitness"
  | "professional-services"
  | "ecommerce"
  | "other"

export type V2JourneyStep =
  | "intro"
  | "industry-selection"
  | "industry-simulation"
  | "forge"
  | "final"

export interface V2Scene {
  id: string
  title: string
  subtitle: string
  image: string
  industry: V2Industry | "all"
  journeyStep: V2JourneyStep
  objectPosition: string
  mobileObjectPosition: string
}

export const v2Scenes: V2Scene[] = [
  {
    id: "intro",
    title: "Welcome to the future of business websites.",
    subtitle: "We are not going to show you a website. We are going to build one around your business.",
    image: "/v2/scenes/interactive-journey-intro.png",
    industry: "all",
    journeyStep: "intro",
    objectPosition: "center center",
    mobileObjectPosition: "center center",
  },
  {
    id: "industry-selection",
    title: "What kind of business are you building for?",
    subtitle: "Choose the operating model so the simulation can adapt around the business.",
    image: "/v2/scenes/experience-gate-background.png",
    industry: "all",
    journeyStep: "industry-selection",
    objectPosition: "center center",
    mobileObjectPosition: "52% center",
  },
  {
    id: "local-trade-simulation",
    title: "A trade business that runs cleaner from first enquiry to paid invoice.",
    subtitle: "Quotes, booking slots, routes, job photos and invoice flow become one connected operating path.",
    image: "/v2/scenes/local-trade-scene.png",
    industry: "local-trade-builder",
    journeyStep: "industry-simulation",
    objectPosition: "center center",
    mobileObjectPosition: "58% center",
  },
  {
    id: "restaurant-simulation",
    title: "A restaurant system built around bookings, menus, orders and reviews.",
    subtitle: "The public experience and back-of-house signals work together instead of living in separate tools.",
    image: "/v2/scenes/restaurant-scene.png",
    industry: "restaurant-food",
    journeyStep: "industry-simulation",
    objectPosition: "center center",
    mobileObjectPosition: "54% center",
  },
  {
    id: "gym-simulation",
    title: "A fitness business with membership, classes and retention in one view.",
    subtitle: "The site becomes a growth surface for signups, schedules, retention loops and performance insight.",
    image: "/v2/scenes/gym-scene.png",
    industry: "gym-fitness",
    journeyStep: "industry-simulation",
    objectPosition: "center center",
    mobileObjectPosition: "48% center",
  },
  {
    id: "professional-services-simulation",
    title: "A professional services pipeline that qualifies, books and follows up.",
    subtitle: "Documents, enquiries, appointment flow and client pipeline become a calm operating system.",
    image: "/v2/scenes/professional-services-scene.png",
    industry: "professional-services",
    journeyStep: "industry-simulation",
    objectPosition: "center center",
    mobileObjectPosition: "45% center",
  },
  {
    id: "ecommerce-simulation",
    title: "An ecommerce system shaped around recommendation, basket and fulfilment.",
    subtitle: "Products, assistance, delivery signals and conversion logic work as one intelligent commerce path.",
    image: "/v2/scenes/ecommerce-scene.png",
    industry: "ecommerce",
    journeyStep: "industry-simulation",
    objectPosition: "center center",
    mobileObjectPosition: "42% center",
  },
  {
    id: "other-simulation",
    title: "A business system shaped around the way your customers actually move.",
    subtitle: "We start with the model, then connect the website, automation and operating flow around it.",
    image: "/v2/scenes/experience-gate-background.png",
    industry: "other",
    journeyStep: "industry-simulation",
    objectPosition: "center center",
    mobileObjectPosition: "52% center",
  },
  {
    id: "forge-build",
    title: "Now we forge the system.",
    subtitle: "Pages, CRM signals, automations, SEO maps and analytics become one buildable architecture.",
    image: "/v2/scenes/forge-build-scene.png",
    industry: "all",
    journeyStep: "forge",
    objectPosition: "center center",
    mobileObjectPosition: "48% center",
  },
  {
    id: "final-cta",
    title: "Your business system is ready.",
    subtitle: "Shall we make it real?",
    image: "/v2/scenes/final-cta-scene.png",
    industry: "all",
    journeyStep: "final",
    objectPosition: "center center",
    mobileObjectPosition: "50% center",
  },
]

export function getSceneByStep(journeyStep: V2JourneyStep) {
  return v2Scenes.find((scene) => scene.journeyStep === journeyStep && scene.industry === "all")
}

export function getSimulationSceneForIndustry(industry: V2Industry | null) {
  return (
    v2Scenes.find((scene) => scene.journeyStep === "industry-simulation" && scene.industry === industry) ??
    v2Scenes.find((scene) => scene.id === "other-simulation")!
  )
}
