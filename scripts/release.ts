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
  console.error("Please provided the GITHUB_TOKEN environment variable");
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
    "You have outstanding changes in your working directory. Please commit or stash them first before proceeding."
  );
  process.exit(1);
}

console.log("Preparing to version packages...");

const releasePlan = await getReleasePlan(process.cwd());

if (releasePlan.changesets.length === 0) {
  console.error("No changesets found...");
  process.exit(1);
}

const statusResult = await execa({ reject: false })`pnpm changeset status`;
if (statusResult.failed) {
  console.error(statusResult.stderr);
  process.exit(1);
}

console.log(statusResult.stdout);

const versionResult = await execa({ reject: false })`pnpm changeset version`;
if (versionResult.failed) {
  console.error(versionResult.stderr);
  process.exit(1);
}

const shouldCommit = await yesNoQuestion(prompt, "Commit ?", {
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

const shouldTag = await yesNoQuestion(prompt, "Create tags?", {
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

const shouldPush = await yesNoQuestion(prompt, "Push to git forge?", {
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

console.log(pushResult.stdout);

const shouldRelease = await yesNoQuestion(prompt, "Release to Github?");
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
    releases.push(releaseResponse.url);
  } catch (e) {
    console.error(e);
    console.error(
      `Something went wrong while releasing ${pkg.packageJson.name}`
    );
    process.exit(1);
  }
}

console.log("Github releases: ");
console.log("-------------------");
for (const release of releases) {
  console.log(`🔗 ${release}`);
}
console.log(`\n`);
console.log(`Release successful! 🚀`);
