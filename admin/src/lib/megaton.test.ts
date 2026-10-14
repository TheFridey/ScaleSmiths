import { describe, expect, it } from "vitest";
import {
  classifyMessage,
  websiteObservations,
  draftOutreach,
  emailAddress,
  evidenceInput,
  scoreEvidence,
  type EvidenceInput,
} from "./megaton";
describe("Megaton evidence and communication boundaries", () => {
  const evidence: EvidenceInput = {
    category: "digital",
    observation: "Homepage lacks viewport",
    sourceUrl: "https://example.com",
    observedAt: "2026-10-01T00:00:00Z",
    confidence: 1,
    strength: 1,
  };
  it("does not inflate unknown data or stale observations", () => {
    expect(scoreEvidence([], new Date("2026-10-13")).status).toBe(
      "Insufficient Evidence",
    );
    const score = scoreEvidence([evidence], new Date("2026-10-13"));
    expect(score.score).toBe(25);
    expect(score.coverage).toBe(25);
    expect(score.status).toBe("Insufficient Evidence");
    expect(scoreEvidence([evidence], new Date("2027-03-01")).score).toBe(0);
  });
  it("does not stack multiple weak observations into maximum category points", () => {
    expect(
      scoreEvidence(
        [evidence, { ...evidence, strength: 0.1 }],
        new Date("2026-10-13"),
      ).score,
    ).toBe(25);
  });
  it("requires attribution and rejects invalid confidence", () => {
    expect(() => evidenceInput({ ...evidence, confidence: 2 })).toThrow();
    expect(() =>
      evidenceInput({ ...evidence, sourceUrl: "file:///etc/passwd" }),
    ).toThrow();
  });
  it("rejects recipient injection and multiple recipients", () => {
    for (const address of ["a@b.com\r\nBcc: x@y.com", "a@b.com,c@d.com"])
      expect(() => emailAddress(address)).toThrow();
  });
  it("routes buying requests and ambiguity to human review", () => {
    expect(classifyMessage("Can we book a meeting and get a quote?").kind).toBe(
      "buying_intent",
    );
    expect(classifyMessage("Unsubscribe me").kind).toBe("suppression");
    expect(classifyMessage("Thanks").takeover).toBe(true);
  });
  it("includes the audit in partnership drafts without charging twice", () => {
    const draft = draftOutreach("Example", "partnership", []);
    expect(draft.body).toContain("£350/month");
    expect(draft.body).toContain("audit is included");
    expect(draft.body).not.toContain("£395");
  });
  it("recognises valid viewport markup before suggesting mobile review", () => {
    for (const html of [
      '<meta name="viewport" content="width=device-width">',
      "<META NAME = 'viewport'>",
      '<meta name=viewport content="width=device-width">',
    ])
      expect(websiteObservations(html, "https://example.com")).toHaveLength(1);
    expect(
      websiteObservations("<html>No viewport</html>", "https://example.com"),
    ).toHaveLength(2);
  });
});
