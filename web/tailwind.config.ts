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
    },
  },
  plugins: [],
};

export default config;
