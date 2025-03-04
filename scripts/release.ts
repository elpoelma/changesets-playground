import { execa } from "execa";
import readline from "readline/promises";
import getReleasePlan from "@changesets/get-release-plan";
import {
  createRelease,
  determinePackagesToRelease,
  yesNoQuestion,
} from "./utils";
import { Octokit } from "octokit";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error("\nPlease provided the GITHUB_TOKEN environment variable");
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

const prompt = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const gitDiffResult = await execa({
  reject: false,
})`git diff HEAD --quiet`;

if (gitDiffResult.failed) {
  console.error(
    "\nYou have outstanding changes in your working directory. Please commit or stash them first before proceeding."
  );
  process.exit(1);
}

console.log("\nPreparing to version packages...");

const releasePlan = await getReleasePlan(process.cwd());

if (releasePlan.changesets.length === 0) {
  console.error("\nNo changesets found...");
  process.exit(1);
}

const statusResult = await execa({ reject: false })`pnpm changeset status`;
if (statusResult.failed) {
  console.error(statusResult.stderr);
  process.exit(1);
}

console.log(`${statusResult.stdout}\n`);

const versionResult = await execa({ reject: false })`pnpm changeset version`;
if (versionResult.failed) {
  console.error(versionResult.stderr);
  process.exit(1);
}
console.log('\n');

const shouldCommit = await yesNoQuestion(prompt, "\nCommit ?", {
  defaultAnswer: true,
});
if (!shouldCommit) {
  process.exit(0);
}

const stageResult = await execa({
  reject: false,
})`git add . --all`;

if (stageResult.failed) {
  console.error(stageResult.stderr);
  process.exit(1);
}

const commitResult = await execa({
  reject: false,
})`git commit -m ${"Version packages"}`;

console.log(commitResult.failed);
if (commitResult.failed) {
  console.error(commitResult.stderr);
  process.exit(1);
}

const shouldTag = await yesNoQuestion(prompt, "\nCreate tags?", {
  defaultAnswer: true,
});
if (!shouldTag) {
  process.exit(0);
}

const tagResult = await execa({ reject: false })`pnpm changeset tag`;

if (tagResult.failed) {
  console.error(tagResult.stderr);
  process.exit(1);
}

const shouldPush = await yesNoQuestion(prompt, "\nPush to git forge?", {
  defaultAnswer: true,
});
if (!shouldPush) {
  process.exit(0);
}

const pushResult = await execa({ reject: false })`git push --follow-tags`;
if (pushResult.failed) {
  console.error(pushResult.stderr);
  process.exit(1);
}

console.log(`\n ${pushResult.stdout}`);

const shouldRelease = await yesNoQuestion(prompt, "\nRelease to Github?");
if (!shouldRelease) {
  process.exit(1);
}

const packagesToRelease = await determinePackagesToRelease(tagResult.stdout);

const releases: string[] = [];
for (const { pkg, tagName } of packagesToRelease) {
  try {
    const releaseResponse = await createRelease(octokit, {
      pkg,
      tagName,
    });
    releases.push(releaseResponse.data.html_url);
  } catch (e) {
    console.error(e);
    console.error(
      `\nSomething went wrong while releasing ${pkg.packageJson.name}`
    );
    process.exit(1);
  }
}

console.log("\nGithub releases: ");
console.log("-------------------");
for (const release of releases) {
  console.log(`🔗 ${release}`);
}
console.log(`\nRelease successful! 🚀`);
process.exit(0);