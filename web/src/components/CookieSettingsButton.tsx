"use client"
import { openCookieSettings } from "./CookiePreferences"
export function CookieSettingsButton() { return <button type="button" onClick={openCookieSettings} className="footer-link inline-flex min-h-6 items-center">Cookie Settings</button> }
