"use client"
import { openCookieSettings } from "./CookiePreferences"
export function PrivacyStorageControls() { return <div className="rounded-xl border border-b1 bg-s1 p-5"><h3 className="font-syne text-lg font-bold text-t1">Your storage choices</h3><p className="mt-2 text-sm text-t2">Open the same preference panel available from the footer to accept, reject or change optional functional and analytics storage.</p><button type="button" className="btn-primary mt-4 text-sm" onClick={openCookieSettings}>Open Cookie Settings</button></div> }
