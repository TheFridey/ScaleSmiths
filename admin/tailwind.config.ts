import type { Config } from "tailwindcss"
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)", s1: "var(--s1)", s2: "var(--s2)", s3: "var(--s3)",
        b1: "var(--b1)", b2: "var(--b2)", t1: "var(--t1)", t2: "var(--t2)", t3: "var(--t3)",
        acc: "var(--acc)", grn: "var(--grn)", amb: "var(--amb)", red: "var(--red)",
      },
      fontFamily: {
        syne: ["var(--font-syne)","sans-serif"],
        dm:   ["var(--font-dm)",  "sans-serif"],
      },
    },
  },
  plugins: [],
}
export default config
