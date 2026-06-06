import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:      "var(--bg)",
        s1:      "var(--s1)",
        s2:      "var(--s2)",
        s3:      "var(--s3)",
        b1:      "var(--b1)",
        b2:      "var(--b2)",
        b3:      "var(--b3)",
        t1:      "var(--t1)",
        t2:      "var(--t2)",
        t3:      "var(--t3)",
        acc:     "var(--acc)",
        silver:  "var(--silver)",
        success: "var(--grn)",
        warning: "var(--amb)",
        danger:  "var(--red)",
      },
      fontFamily: {
        syne: ["var(--font-syne)", "sans-serif"],
        dm:   ["var(--font-dm)",   "sans-serif"],
      },
      animation: {
        "ticker":   "ticker 32s linear infinite",
        "float":    "float 4.5s ease-in-out infinite",
        "pulse-dot":"pulse-dot 2.2s ease infinite",
        "drift":    "drift var(--duration, 8s) ease-in-out infinite",
      },
      keyframes: {
        ticker:     { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        float:      { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        "pulse-dot":{ "0%,100%": { boxShadow: "0 0 0 0 rgba(16,185,129,.35)" }, "50%": { boxShadow: "0 0 0 6px rgba(16,185,129,0)" } },
        drift:      { "0%": { opacity: "0", transform: "translate(0,0)" }, "10%": { opacity: ".07" }, "90%": { opacity: ".07" }, "100%": { opacity: "0", transform: "translate(var(--px,0px), var(--py,-100px))" } },
      },
    },
  },
  plugins: [],
};

export default config;
