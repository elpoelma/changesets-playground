import { execa } from 'execa';
import { getRemote } from './utils';

const PACKAGE_NAME = 'package-a';
const PACKAGE_PATH = 'packages/package-a';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('\nPlease provided the GITHUB_TOKEN environment variable');
  process.exit(1);
}

const mostRecentCommit = await execa`git rev-parse HEAD`;

const currentVersion = await execa({ cwd: PACKAGE_PATH })`npm pkg get version`;

const tagToCreate = `${PACKAGE_NAME}@${currentVersion.stdout.replaceAll('"', '')}-dev.${mostRecentCommit.stdout}`;

const remote = await getRemote() ?? 'origin';

const doesTagExistOnRemote = await execa`git ls-remote ${remote} refs/tags/${tagToCreate}`;

const tagExistsOnRemote = Boolean(doesTagExistOnRemote.stdout);
if(tagExistsOnRemote){
  console.log(`A dev release has already been created for the latest commit with tag ${tagToCreate}`)
  process.exit(0);
}

const doesTagExistLocally = await execa`git tag -l ${tagToCreate}`

const tagExistsLocally = Boolean(doesTagExistLocally.stdout);
if(!tagExistsLocally){
  await execa`git tag -a ${tagToCreate} -m "dev-release"`
}
await execa`git push ${remote} tag ${tagToCreate}`;
console.log(`Succesfully created and pushed a dev-release tag: ${tagToCreate}`)
