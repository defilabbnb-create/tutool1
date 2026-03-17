const requiredMajorMin = 20;
const requiredMajorMax = 22;
const mode = process.argv[2] ?? "strict";

const currentVersion = process.versions.node;
const [majorString] = currentVersion.split(".");
const major = Number.parseInt(majorString, 10);

const isSupported =
  Number.isInteger(major) &&
  major >= requiredMajorMin &&
  major <= requiredMajorMax;

if (!isSupported) {
  const lines = [
    "",
    "Unsupported Node.js version detected.",
    `Current: v${currentVersion}`,
    `Required: v${requiredMajorMin}.x to v${requiredMajorMax}.x`,
    "",
    "Fix:",
    "1) nvm install 22",
    "2) nvm use 22",
    "3) npm install",
    "",
  ];

  for (const line of lines) {
    const write = mode === "warn" ? console.warn : console.error;
    write(line);
  }

  if (mode !== "warn") {
    process.exit(1);
  }
}
