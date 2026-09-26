import { describe, expect, it } from "vitest"
import {
  architectureCapabilityGroups,
  architectureDeploymentOptions,
  architectureDiagramLayers,
  architectureFrameworkCopy,
  architectureRelatedLinks,
} from "./enterprise-architecture"

describe("enterprise architecture framework", () => {
  it("keeps the problem-led positioning and six capability groups", () => {
    expect(architectureFrameworkCopy.title).toBe("Architecture follows the problem.")
    expect(architectureCapabilityGroups.map((group) => group.id)).toEqual([
      "identity",
      "applications",
      "data",
      "integration",
      "infrastructure",
      "operations",
    ])
  })

  it("explains why each capability matters operationally", () => {
    for (const group of architectureCapabilityGroups) {
      expect(group.capabilities.length).toBeGreaterThanOrEqual(5)
      for (const capability of group.capabilities) {
        expect(capability.name.length).toBeGreaterThan(1)
        expect(capability.why.length).toBeGreaterThan(40)
        expect(capability.why.toLowerCase()).not.toBe(capability.name.toLowerCase())
      }
    }

    const identity = architectureCapabilityGroups.find((group) => group.id === "identity")
    expect(identity?.capabilities.map((item) => item.name)).toEqual(expect.arrayContaining([
      "SSO",
      "MFA",
      "OIDC",
      "SAML",
      "RBAC",
      "ABAC",
      "User provisioning",
    ]))
  })

  it("covers deployment options and a generic diagram without private client names", () => {
    expect(architectureDeploymentOptions.map((item) => item.title)).toEqual(expect.arrayContaining([
      "ScaleSmiths-managed infrastructure",
      "Client-controlled cloud environments",
      "Approved Azure / AWS environments",
      "Portable Docker-based deployments",
    ]))
    expect(architectureDiagramLayers.map((layer) => layer.label)).toEqual([
      "Users",
      "Identity Provider",
      "Web / Mobile Application",
      "API Layer",
      "Application Services",
      "PostgreSQL / Redis / Object Storage",
      "Integrations",
      "Monitoring / Audit / Reporting",
    ])

    const blob = JSON.stringify({
      architectureCapabilityGroups,
      architectureDeploymentOptions,
      architectureFrameworkCopy,
    }).toLowerCase()
    expect(blob).not.toContain("alloga")
    expect(blob).not.toContain("cencora")
  })

  it("links to enterprise, security and delivery routes", () => {
    expect(architectureRelatedLinks.map((link) => link.href)).toEqual([
      "/enterprise",
      "/security",
      "/enterprise/delivery",
    ])
  })
})
