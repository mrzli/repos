import { compareRepositories } from './repository-data.mjs';
import { TOPIC_CATEGORIES } from './topic-categories.mjs';

export function createReadme(username, repositories, userRepositories) {
  const primaryGroups = groupUserRepositories(userRepositories.valid);
  const organizationGroups = groupOrganizationRepositories(
    username,
    repositories,
  );
  const archivedGroups = groupArchivedRepositories(username, repositories);

  const lines = [
    '# Repos',
    '',
    `## User Repos ('${username}')`,
    '',
    ...createPrimaryGroupLines(primaryGroups),
    '',
    '---',
    '',
    ...createOrganizationGroupLines(organizationGroups),
    '',
    '---',
    '',
    ...createArchivedGroupLines(archivedGroups),
  ];

  if (userRepositories.invalid.length > 0) {
    lines.push(
      '',
      '---',
      '',
      '## Uncategorized User Repos',
      '',
      ...userRepositories.invalid.map(createRepositoryLine),
    );
  }

  return `${lines.join('\n')}\n`;
}

function groupUserRepositories(repositories) {
  const primaryGroups = new Map();

  for (const repo of repositories) {
    const category = TOPIC_CATEGORIES.get(repo.topics[0]);
    let primaryGroup = primaryGroups.get(category.primary);

    if (!primaryGroup) {
      primaryGroup = {
        primary: category.primary,
        order: category.order,
        secondaryGroups: new Map(),
      };
      primaryGroups.set(category.primary, primaryGroup);
    }

    const secondaryKey = category.secondary ?? '';
    let secondaryGroup = primaryGroup.secondaryGroups.get(secondaryKey);

    if (!secondaryGroup) {
      secondaryGroup = {
        secondary: category.secondary,
        order: category.order,
        repositories: [],
      };
      primaryGroup.secondaryGroups.set(secondaryKey, secondaryGroup);
    }

    secondaryGroup.repositories.push(repo);
  }

  return [...primaryGroups.values()]
    .sort((left, right) => left.order - right.order)
    .map((primaryGroup) => ({
      primary: primaryGroup.primary,
      secondaryGroups: [...primaryGroup.secondaryGroups.values()]
        .sort((left, right) => left.order - right.order)
        .map((secondaryGroup) => ({
          secondary: secondaryGroup.secondary,
          repositories: secondaryGroup.repositories.sort(compareRepositories),
        })),
    }));
}

function groupOrganizationRepositories(username, repositories) {
  return groupRepositoriesByOwner(
    repositories.filter(
      (repo) => repo.owner !== username && !repo.archived,
    ),
  );
}

function groupArchivedRepositories(username, repositories) {
  const archived = repositories.filter((repo) => repo.archived);

  return {
    user: {
      owner: username,
      repositories: archived
        .filter((repo) => repo.owner === username)
        .sort(compareRepositories),
    },
    organizations: groupRepositoriesByOwner(
      archived.filter((repo) => repo.owner !== username),
    ),
  };
}

function groupRepositoriesByOwner(repositories) {
  const groups = new Map();

  for (const repo of repositories) {
    const ownerRepositories = groups.get(repo.owner) ?? [];
    ownerRepositories.push(repo);
    groups.set(repo.owner, ownerRepositories);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([owner, ownerRepositories]) => ({
      owner,
      repositories: ownerRepositories.sort(compareRepositories),
    }));
}

function createPrimaryGroupLines(primaryGroups) {
  return primaryGroups.flatMap((primaryGroup, primaryIndex) => {
    const lines = [`### ${primaryGroup.primary}`, ''];

    primaryGroup.secondaryGroups.forEach((secondaryGroup, secondaryIndex) => {
      if (secondaryGroup.secondary !== null) {
        lines.push(`#### ${secondaryGroup.secondary}`, '');
      }

      lines.push(...secondaryGroup.repositories.map(createRepositoryLine));

      if (secondaryIndex < primaryGroup.secondaryGroups.length - 1) {
        lines.push('');
      }
    });

    if (primaryIndex < primaryGroups.length - 1) {
      lines.push('', '---', '');
    }

    return lines;
  });
}

function createOrganizationGroupLines(groups) {
  const lines = ['## Org Repos', ''];

  groups.forEach((group, index) => {
    lines.push(
      `### Org ('${group.owner}')`,
      '',
      ...group.repositories.map(createRepositoryLine),
    );

    if (index < groups.length - 1) {
      lines.push('', '---', '');
    }
  });

  return lines;
}

function createArchivedGroupLines(groups) {
  const lines = [
    '## Archived Repos',
    '',
    `### User ('${groups.user.owner}')`,
    '',
    ...groups.user.repositories.map(createRepositoryLine),
  ];

  for (const group of groups.organizations) {
    lines.push(
      '',
      '---',
      '',
      `### Org ('${group.owner}')`,
      '',
      ...group.repositories.map(createRepositoryLine),
    );
  }

  return lines;
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
