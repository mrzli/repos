import { writeFile } from 'node:fs/promises';
import { loadRepositoryData } from './github-api.mjs';
import { createReadme } from './markdown.mjs';

const OUTPUT_PATH = 'README.md';
const token = process.env.GITHUB_TOKEN;

async function main() {
  if (!token) {
    throw new Error(
      'GITHUB_TOKEN is missing. Add it to .env.local, then run ' +
        '`npm run generate`.',
    );
  }

  const { username, organizations, repositories } =
    await loadRepositoryData(token);
  const markdown = createReadme(username, organizations, repositories);
  await writeFile(OUTPUT_PATH, markdown, 'utf8');

  console.error(`Wrote ${OUTPUT_PATH} with ${repositories.length} repositories.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
