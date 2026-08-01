import "server-only"

export class ForgeRunError extends Error {
  constructor(public safeMessage: string, public status = 400, public code = "forge_run_error") {
    super(safeMessage)
    this.name = "ForgeRunError"
  }
}
