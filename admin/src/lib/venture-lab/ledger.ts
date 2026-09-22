import { assertMinorUnits } from "./money"
import type { LedgerPosting } from "./types"

export function assertBalancedPostings(postings: readonly LedgerPosting[]): void {
  if (postings.length < 2) {
    throw new Error("A ledger journal requires at least two postings.")
  }

  let debits = 0
  let credits = 0

  for (const posting of postings) {
    assertMinorUnits(posting.debitMinor, `${posting.account}.debitMinor`)
    assertMinorUnits(posting.creditMinor, `${posting.account}.creditMinor`)

    const hasDebit = posting.debitMinor > 0
    const hasCredit = posting.creditMinor > 0

    if (hasDebit === hasCredit) {
      throw new Error(`Posting for ${posting.account} must contain exactly one positive debit or credit.`)
    }

    debits += posting.debitMinor
    credits += posting.creditMinor
  }

  if (!Number.isSafeInteger(debits) || !Number.isSafeInteger(credits)) {
    throw new Error("Ledger totals exceed the safe integer boundary.")
  }

  if (debits !== credits) {
    throw new Error(`Unbalanced ledger journal: debit ${debits}, credit ${credits}.`)
  }
}
