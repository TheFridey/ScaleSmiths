"use client"
import { openCookieSettings } from "./CookiePreferences"
export function CookieSettingsButton() { return <button type="button" onClick={openCookieSettings} className="footer-link">Cookie Settings</button> }
