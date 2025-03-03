import { execa } from "execa";
import { program } from "commander";
import readline from "readline/promises";

const prompt = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function yesNoQuestion(question: string, { defaultAnswer = false } = {}) {
  const answer = (await prompt.question(`${question} (Y/n) `)).trim();
  return answer ? answer === "Y" || answer === "y" : defaultAnswer;
}
// const gitDiffResult = await execa({
//   reject: false,
// })`git diff --quiet && git diff --cached --quiet`;
// if (gitDiffResult.failed) {
//   console.error(
//     "You have outstanding changes in your working directory. Please commit or revert them first before proceeding."
//   );
//   process.exit(1);
// }

console.log("Preparing to version packages...");
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

const shouldCommit = await yesNoQuestion("Commit ?", { defaultAnswer: true });
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

const shouldTag = await yesNoQuestion("Create tags?", { defaultAnswer: true });
if (!shouldTag) {
  process.exit(0);
}

const tagResult = await execa({ reject: false })`pnpm changeset tag`;

if (tagResult.failed) {
  console.error(tagResult.stderr);
  process.exit(1);
}

const shouldPush = await yesNoQuestion("Push to git forge?", {
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

const shouldRelease = await yesNoQuestion("Release to Github?");
if (!shouldRelease) {
  process.exit(1);
}
