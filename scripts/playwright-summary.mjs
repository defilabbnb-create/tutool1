import fs from "node:fs";

const reportPath = process.argv[2] || "test-results/playwright-report.json";

if (!fs.existsSync(reportPath)) {
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

const totals = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
};

const failingTests = [];

function visitSuite(suite, parents = []) {
  for (const spec of suite.specs ?? []) {
    const titles = [...parents, spec.title];

    for (const test of spec.tests ?? []) {
      totals.total += 1;

      const results = test.results ?? [];
      const statuses = results.map((result) => result.status);
      const status = statuses.includes("failed")
        ? "failed"
        : statuses.includes("passed")
          ? "passed"
          : statuses.includes("skipped")
            ? "skipped"
            : test.status ?? "unknown";

      if (status === "passed") {
        totals.passed += 1;
      } else if (status === "failed") {
        totals.failed += 1;
        failingTests.push(titles.join(" › "));
      } else if (status === "skipped") {
        totals.skipped += 1;
      }
    }
  }

  for (const child of suite.suites ?? []) {
    visitSuite(child, child.title ? [...parents, child.title] : parents);
  }
}

for (const suite of report.suites ?? []) {
  visitSuite(suite, suite.title ? [suite.title] : []);
}

const lines = [
  "## Playwright Summary",
  "",
  `- Total: ${totals.total}`,
  `- Passed: ${totals.passed}`,
  `- Failed: ${totals.failed}`,
  `- Skipped: ${totals.skipped}`,
];

if (failingTests.length > 0) {
  lines.push("", "### Key failing scenarios");

  for (const title of failingTests.slice(0, 10)) {
    lines.push(`- ${title}`);
  }
}

const summaryPath = process.env.GITHUB_STEP_SUMMARY;

if (summaryPath) {
  fs.appendFileSync(summaryPath, `${lines.join("\n")}\n`);
} else {
  console.log(lines.join("\n"));
}
