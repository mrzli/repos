import { compareRepositories } from './repository-data.mjs';

export function createReadme(username, organizations, repositories) {
  const lines = [
    '# Repos',
    '',
    ...createOwnerLines(username, repositories, false),
  ];

  for (const organization of organizations) {
    lines.push(
      '',
      ...createOwnerLines(organization, repositories, true),
    );
  }

  return `${lines.join('\n')}\n`;
}

function createOwnerLines(owner, repositories, organization) {
  const ownerRepositories = repositories
    .filter((repo) => repo.owner === owner)
    .sort(compareRepositories);
  const heading = organization ? `## ${owner} (Org)` : `## ${owner}`;

  return [
    heading,
    '',
    ...createRepositoryLines(ownerRepositories),
  ];
}

function createRepositoryLines(repositories) {
  return repositories.length === 0
    ? ['> No repositories.']
    : repositories.map(createRepositoryLine);
}

function createRepositoryLine(repo) {
  const markers = [
    repo.archived ? '**A**' : null,
    repo.visibility === 'private' ? '**P**' : null,
    repo.visibility === 'internal' ? '**I**' : null,
  ].filter(Boolean);

  const description =
    typeof repo.description === 'string' && repo.description.length > 0
      ? `_${repo.description}_`
      : '&lt;NO-DESCRIPTION&gt;';

  return [
    '-',
    ...markers,
    `[${repo.name}](${repo.url})`,
    '-',
    description,
  ].join(' ');
}
