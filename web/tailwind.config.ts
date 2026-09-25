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
        "acc-ink": "var(--acc-ink)",
        silver:  "var(--silver)",
        success: "var(--grn)",
        warning: "var(--amb)",
        danger:  "var(--red)",
        paper: {
          DEFAULT: "var(--paper)",
          soft: "var(--paper-soft)",
          raised: "var(--paper-raised)",
          ink: "var(--paper-ink)",
          text: "var(--paper-text)",
          muted: "var(--paper-muted)",
          border: "var(--paper-border)",
          acc: "var(--paper-acc)",
        },
        control: {
          DEFAULT: "var(--control-border)",
          hover: "var(--control-border-hover)",
          focus: "var(--control-border-focus)",
        },
      },
      fontFamily: {
        syne: ["var(--font-syne)", "sans-serif"],
        dm:   ["var(--font-dm)",   "sans-serif"],
      },
      minHeight: {
        tap: "44px",
      },
      minWidth: {
        tap: "44px",
      },
    },
  },
  plugins: [],
};

export default config;
