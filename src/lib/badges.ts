import type { Badge } from "./types";

export type BadgeDef = {
  id: string;
  label: string;
  /** simple-icons slug */
  logo: string;
  /** hex color without the leading hash */
  color: string;
  /** logo tint, defaults to white */
  logoColor?: string;
  category: string;
  /** dependency names / keywords that imply this badge */
  match?: string[];
};

const B = (
  id: string,
  label: string,
  logo: string,
  color: string,
  category: string,
  match?: string[],
  logoColor?: string,
): BadgeDef => ({ id, label, logo, color, category, match, logoColor });

export const BADGE_CATALOG: BadgeDef[] = [
  // Languages
  B("typescript", "TypeScript", "typescript", "3178C6", "Language", ["typescript", "ts"]),
  B("javascript", "JavaScript", "javascript", "F7DF1E", "Language", ["javascript"], "black"),
  B("python", "Python", "python", "3776AB", "Language", ["python"]),
  B("go", "Go", "go", "00ADD8", "Language", ["golang", "go"]),
  B("rust", "Rust", "rust", "000000", "Language", ["rust"]),
  B("java", "Java", "openjdk", "ED8B00", "Language", ["java"]),
  B("kotlin", "Kotlin", "kotlin", "7F52FF", "Language", ["kotlin"]),
  B("swift", "Swift", "swift", "F05138", "Language", ["swift"]),
  B("cpp", "C++", "cplusplus", "00599C", "Language", ["c++", "cpp"]),
  B("csharp", "C Sharp", "dotnet", "512BD4", "Language", ["c#", "csharp", "dotnet"]),
  B("php", "PHP", "php", "777BB4", "Language", ["php"]),
  B("ruby", "Ruby", "ruby", "CC342D", "Language", ["ruby"]),
  B("dart", "Dart", "dart", "0175C2", "Language", ["dart"]),
  B("html", "HTML5", "html5", "E34F26", "Language", ["html"]),
  B("css", "CSS3", "css3", "1572B6", "Language", ["css"]),

  // Frontend
  B("react", "React", "react", "20232A", "Frontend", ["react", "react-dom"], "61DAFB"),
  B("nextjs", "Next.js", "nextdotjs", "000000", "Frontend", ["next"]),
  B("vue", "Vue.js", "vuedotjs", "35495E", "Frontend", ["vue"], "4FC08D"),
  B("nuxt", "Nuxt", "nuxtdotjs", "00DC82", "Frontend", ["nuxt"]),
  B("svelte", "Svelte", "svelte", "FF3E00", "Frontend", ["svelte", "@sveltejs/kit"]),
  B("angular", "Angular", "angular", "DD0031", "Frontend", ["@angular/core"]),
  B("astro", "Astro", "astro", "FF5D01", "Frontend", ["astro"]),
  B("solid", "SolidJS", "solid", "2C4F7C", "Frontend", ["solid-js"]),
  B("vite", "Vite", "vite", "646CFF", "Frontend", ["vite"]),
  B("webpack", "Webpack", "webpack", "8DD6F9", "Frontend", ["webpack"], "black"),
  B("tailwind", "Tailwind CSS", "tailwindcss", "06B6D4", "Frontend", ["tailwindcss"]),
  B("bootstrap", "Bootstrap", "bootstrap", "7952B3", "Frontend", ["bootstrap"]),
  B("sass", "Sass", "sass", "CC6699", "Frontend", ["sass", "node-sass"]),
  B("mui", "MUI", "mui", "007FFF", "Frontend", ["@mui/material"]),
  B("redux", "Redux", "redux", "593D88", "Frontend", ["redux", "@reduxjs/toolkit"]),
  B("electron", "Electron", "electron", "191970", "Frontend", ["electron"]),

  // Backend
  B("nodejs", "Node.js", "nodedotjs", "6DA55F", "Backend", ["node"]),
  B("express", "Express.js", "express", "000000", "Backend", ["express"]),
  B("nestjs", "NestJS", "nestjs", "E0234E", "Backend", ["@nestjs/core"]),
  B("fastify", "Fastify", "fastify", "000000", "Backend", ["fastify"]),
  B("django", "Django", "django", "092E20", "Backend", ["django"]),
  B("flask", "Flask", "flask", "000000", "Backend", ["flask"]),
  B("fastapi", "FastAPI", "fastapi", "009688", "Backend", ["fastapi"]),
  B("rails", "Rails", "rubyonrails", "CC0000", "Backend", ["rails"]),
  B("laravel", "Laravel", "laravel", "FF2D20", "Backend", ["laravel/framework"]),
  B("spring", "Spring", "spring", "6DB33F", "Backend", ["spring-boot"]),
  B("graphql", "GraphQL", "graphql", "E10098", "Backend", ["graphql", "apollo-server"]),
  B("socketio", "Socket.io", "socketdotio", "010101", "Backend", ["socket.io"]),

  // Data
  B("postgres", "PostgreSQL", "postgresql", "4169E1", "Data", ["pg", "postgres", "psycopg2"]),
  B("mysql", "MySQL", "mysql", "4479A1", "Data", ["mysql", "mysql2"]),
  B("sqlite", "SQLite", "sqlite", "07405E", "Data", ["sqlite3", "better-sqlite3"]),
  B("mongodb", "MongoDB", "mongodb", "47A248", "Data", ["mongodb", "mongoose"]),
  B("redis", "Redis", "redis", "DD0031", "Data", ["redis", "ioredis"]),
  B("prisma", "Prisma", "prisma", "2D3748", "Data", ["prisma", "@prisma/client"]),
  B("drizzle", "Drizzle", "drizzle", "C5F74F", "Data", ["drizzle-orm"], "black"),
  B("supabase", "Supabase", "supabase", "3FCF8E", "Data", ["@supabase/supabase-js"]),
  B("firebase", "Firebase", "firebase", "FFCA28", "Data", ["firebase"], "black"),
  B("elastic", "Elasticsearch", "elasticsearch", "005571", "Data", ["elasticsearch"]),

  // Cloud and DevOps
  B("docker", "Docker", "docker", "2496ED", "DevOps", ["docker"]),
  B("kubernetes", "Kubernetes", "kubernetes", "326CE5", "DevOps", ["kubernetes"]),
  B("aws", "AWS", "amazonwebservices", "232F3E", "DevOps", ["aws-sdk", "@aws-sdk/client-s3"]),
  B("gcp", "Google Cloud", "googlecloud", "4285F4", "DevOps", ["@google-cloud/storage"]),
  B("azure", "Azure", "microsoftazure", "0078D4", "DevOps", ["azure"]),
  B("vercel", "Vercel", "vercel", "000000", "DevOps", ["vercel"]),
  B("netlify", "Netlify", "netlify", "00C7B7", "DevOps", ["netlify"]),
  B("githubactions", "GitHub Actions", "githubactions", "2088FF", "DevOps", []),
  B("terraform", "Terraform", "terraform", "7B42BC", "DevOps", ["terraform"]),
  B("nginx", "Nginx", "nginx", "009639", "DevOps", ["nginx"]),

  // Tooling and testing
  B("jest", "Jest", "jest", "C21325", "Tooling", ["jest"]),
  B("vitest", "Vitest", "vitest", "6E9F18", "Tooling", ["vitest"]),
  B("playwright", "Playwright", "playwright", "2EAD33", "Tooling", ["@playwright/test", "playwright"]),
  B("cypress", "Cypress", "cypress", "17202C", "Tooling", ["cypress"]),
  B("pytest", "Pytest", "pytest", "0A9EDC", "Tooling", ["pytest"]),
  B("eslint", "ESLint", "eslint", "4B32C3", "Tooling", ["eslint"]),
  B("prettier", "Prettier", "prettier", "F7B93E", "Tooling", ["prettier"], "black"),
  B("git", "Git", "git", "F05033", "Tooling", ["git"]),
  B("npm", "npm", "npm", "CB3837", "Tooling", []),
  B("pnpm", "pnpm", "pnpm", "F69220", "Tooling", []),

  // AI
  B("anthropic", "Anthropic", "anthropic", "D97757", "AI", ["@anthropic-ai/sdk", "anthropic"]),
  B("openai", "OpenAI", "openai", "412991", "AI", ["openai"]),
  B("huggingface", "Hugging Face", "huggingface", "FFD21E", "AI", ["transformers"], "black"),
  B("pytorch", "PyTorch", "pytorch", "EE4C2C", "AI", ["torch"]),
  B("tensorflow", "TensorFlow", "tensorflow", "FF6F00", "AI", ["tensorflow"]),
  B("pandas", "Pandas", "pandas", "150458", "AI", ["pandas"]),
  B("numpy", "NumPy", "numpy", "013243", "AI", ["numpy"]),
];

export const BADGE_CATEGORIES = Array.from(
  new Set(BADGE_CATALOG.map((b) => b.category)),
);

export function techBadge(def: BadgeDef, style = "for-the-badge"): Badge {
  const label = encodeURIComponent(def.label.replace(/-/g, "--"));
  const url =
    "https://img.shields.io/badge/" +
    label +
    "-" +
    def.color +
    "?style=" +
    style +
    "&logo=" +
    def.logo +
    "&logoColor=" +
    (def.logoColor ?? "white");
  return { id: def.id, label: def.label, url };
}

export function badgeById(id: string, style?: string): Badge | undefined {
  const def = BADGE_CATALOG.find((b) => b.id === id);
  return def ? techBadge(def, style) : undefined;
}

/** Dynamic repo badges. `repo` is "owner/name". */
export function repoBadges(
  repo: string | undefined,
  license: string | undefined,
  style = "for-the-badge",
): Badge[] {
  const out: Badge[] = [];
  if (repo) {
    out.push({
      id: "stars",
      label: "Stars",
      url: `https://img.shields.io/github/stars/${repo}?style=${style}&color=FFD700`,
      href: `https://github.com/${repo}/stargazers`,
    });
    out.push({
      id: "issues",
      label: "Issues",
      url: `https://img.shields.io/github/issues/${repo}?style=${style}&color=FF6B6B`,
      href: `https://github.com/${repo}/issues`,
    });
    out.push({
      id: "lastcommit",
      label: "Last commit",
      url: `https://img.shields.io/github/last-commit/${repo}?style=${style}&color=4C9AFF`,
    });
    out.push({
      id: "license-dyn",
      label: "License",
      url: `https://img.shields.io/github/license/${repo}?style=${style}&color=6BCB77`,
    });
  } else if (license) {
    const l = encodeURIComponent(license.replace(/-/g, "--"));
    out.push({
      id: "license-static",
      label: "License",
      url: `https://img.shields.io/badge/License-${l}-6BCB77?style=${style}`,
    });
  }
  return out;
}

/** Suggest tech badges from dependency names / keywords. */
export function suggestBadges(keywords: string[]): BadgeDef[] {
  const set = new Set(
    keywords.map((k) => k.toLowerCase().trim()).filter(Boolean),
  );
  return BADGE_CATALOG.filter((def) => {
    if (set.has(def.id) || set.has(def.label.toLowerCase())) return true;
    return (def.match ?? []).some((m) => set.has(m));
  });
}
