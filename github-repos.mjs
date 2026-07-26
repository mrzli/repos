import { writeFile } from 'node:fs/promises';

const API_BASE_URL = 'https://api.github.com';
const API_VERSION = '2026-03-10';
const PER_PAGE = 100;
const OUTPUT_PATH = 'README.md';

const token = process.env.GITHUB_TOKEN;

const TOPIC_CATEGORIES = new Map([
  ['docs-generic', { order: 1, primary: 'Docs', secondary: 'Generic' }],
  [
    'docs-development',
    { order: 2, primary: 'Docs', secondary: 'Development' },
  ],
  [
    'libs-shared-util',
    { order: 3, primary: 'Libs', secondary: 'Shared Util' },
  ],
  [
    'libs-browser-util',
    { order: 4, primary: 'Libs', secondary: 'Browser Util' },
  ],
  ['libs-node-util', { order: 5, primary: 'Libs', secondary: 'Node Util' }],
  [
    'libs-development-util',
    { order: 6, primary: 'Libs', secondary: 'Development Util' },
  ],
  ['libs-test-util', { order: 7, primary: 'Libs', secondary: 'Test Util' }],
  ['tools', { order: 8, primary: 'Tools', secondary: null }],
  ['setup', { order: 9, primary: 'Setup', secondary: null }],
  ['template', { order: 10, primary: 'Templates', secondary: null }],
  ['sites', { order: 11, primary: 'Sites', secondary: null }],
  ['trading', { order: 12, primary: 'Trading', secondary: null }],
  ['problems', { order: 13, primary: 'Problems', secondary: null }],
  ['example', { order: 14, primary: 'Example', secondary: null }],
]);

async function main() {
  if (!token) {
    throw new Error(
      'GITHUB_TOKEN is missing. Add it to .env.local and run with ' +
        '`node --env-file=.env.local github-repos.mjs`.',
    );
  }

  const { username, repositories } = await loadRepositoryData();
  const userRepositories = validateActiveUserRepositories(
    username,
    repositories,
  );

  reportValidationErrors(userRepositories.errors);

  const markdown = createReadme(username, repositories, userRepositories);
  await writeFile(OUTPUT_PATH, markdown, 'utf8');

  console.error(`Wrote ${OUTPUT_PATH} with ${repositories.length} repositories.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function loadRepositoryData() {
  const userResponse = await githubRequest(`${API_BASE_URL}/user`);
  const user = await userResponse.json();

  if (typeof user.login !== 'string' || user.login.length === 0) {
    throw new Error('GitHub did not return a valid authenticated user.');
  }

  const personalRepositories = await fetchAll(
    '/user/repos?affiliation=owner&visibility=all',
  );

  const memberships = await fetchAll('/user/memberships/orgs?state=active');
  const ownedOrganizations = memberships.filter(
    (membership) => membership.role === 'admin',
  );

  const organizationRepositories = [];

  for (const membership of ownedOrganizations) {
    const organization = membership.organization?.login;

    if (typeof organization !== 'string' || organization.length === 0) {
      throw new Error(
        'GitHub returned an organization membership without a login.',
      );
    }

    const repositories = await fetchAll(
      `/orgs/${encodeURIComponent(organization)}/repos?type=all`,
    );

    organizationRepositories.push(...repositories);
  }

  const repositoriesById = new Map();

  for (const repo of personalRepositories) {
    const normalized = normalizeRepository(repo, 'user');
    repositoriesById.set(normalized.id, normalized);
  }

  for (const repo of organizationRepositories) {
    const normalized = normalizeRepository(repo, 'organization');
    repositoriesById.set(normalized.id, normalized);
  }

  const repositories = [...repositoriesById.values()].sort(compareRepositories);

  return {
    username: user.login,
    repositories,
  };
}

function validateActiveUserRepositories(username, repositories) {
  const active = repositories.filter(
    (repo) => repo.owner === username && !repo.archived,
  );

  const errors = active
    .map((repo) => validateUserRepository(repo))
    .filter((result) => result !== null);

  const invalidIds = new Set(errors.map((error) => error.id));

  return {
    valid: active.filter((repo) => !invalidIds.has(repo.id)),
    invalid: active.filter((repo) => invalidIds.has(repo.id)),
    errors,
  };
}

function reportValidationErrors(errors) {
  if (errors.length === 0) {
    return;
  }

  console.error(
    `Found topic errors in ${errors.length} active personal repositories:`,
  );
  console.error(JSON.stringify(errors, null, 2));
}

function createReadme(username, repositories, userRepositories) {
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
      '## Invalid User Repos',
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

async function fetchAll(path) {
  const separator = path.includes('?') ? '&' : '?';
  let nextUrl = `${API_BASE_URL}${path}${separator}per_page=${PER_PAGE}`;
  const items = [];

  while (nextUrl) {
    const response = await githubRequest(nextUrl);
    const page = await response.json();

    if (!Array.isArray(page)) {
      throw new Error(`Expected a list from GitHub for ${path}.`);
    }

    items.push(...page);
    nextUrl = getNextPageUrl(response.headers.get('link'));
  }

  return items;
}

async function githubRequest(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': 'github-repository-inventory-script',
    },
  });

  if (!response.ok) {
    let message = response.statusText;

    try {
      const body = await response.json();
      message = body.message ?? message;
    } catch {
      // Keep the HTTP status text when GitHub does not return JSON.
    }

    throw new Error(
      `GitHub API request failed (${response.status}): ${message}`,
    );
  }

  return response;
}

function normalizeRepository(repo, ownerType) {
  const data = {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner?.login,
    ownerType,
    description: repo.description,
    topics: repo.topics ?? [],
    archived: repo.archived,
    visibility: repo.visibility ?? (repo.private ? 'private' : 'public'),
    url: repo.html_url,
  };

  validateRepositoryData(data);
  return data;
}

function validateRepositoryData(repo) {
  const missingFields = [];

  if (!Number.isInteger(repo.id)) {
    missingFields.push('id');
  }
  if (typeof repo.name !== 'string' || repo.name.length === 0) {
    missingFields.push('name');
  }
  if (typeof repo.fullName !== 'string' || repo.fullName.length === 0) {
    missingFields.push('fullName');
  }
  if (typeof repo.owner !== 'string' || repo.owner.length === 0) {
    missingFields.push('owner');
  }
  if (!['user', 'organization'].includes(repo.ownerType)) {
    missingFields.push('ownerType');
  }
  if (
    !Array.isArray(repo.topics) ||
    repo.topics.some((topic) => typeof topic !== 'string')
  ) {
    missingFields.push('topics');
  }
  if (typeof repo.archived !== 'boolean') {
    missingFields.push('archived');
  }
  if (!['public', 'private', 'internal'].includes(repo.visibility)) {
    missingFields.push('visibility');
  }
  if (typeof repo.url !== 'string' || repo.url.length === 0) {
    missingFields.push('url');
  }

  if (missingFields.length > 0) {
    throw new Error(
      `Repository data is missing or invalid for ` +
        `'${repo.fullName ?? repo.name ?? '<unknown>'}': ` +
        `${missingFields.join(', ')}.`,
    );
  }
}

function validateUserRepository(repo) {
  if (repo.topics.length !== 1) {
    return {
      id: repo.id,
      name: repo.name,
      error:
        `Invalid number of topics for repo '${repo.name}'. ` +
        `Expected 1, got ${repo.topics.length}.`,
    };
  }

  const topic = repo.topics[0];

  if (!TOPIC_CATEGORIES.has(topic)) {
    return {
      id: repo.id,
      name: repo.name,
      error: `Invalid topic for repo '${repo.name}': ${topic}.`,
    };
  }

  return null;
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

function getNextPageUrl(linkHeader) {
  if (!linkHeader) {
    return null;
  }

  for (const link of linkHeader.split(',')) {
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function compareRepositories(left, right) {
  return (
    left.owner.localeCompare(right.owner) ||
    left.name.localeCompare(right.name)
  );
}
