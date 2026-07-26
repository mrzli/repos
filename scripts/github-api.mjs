import {
  compareRepositories,
  normalizeRepository,
} from './repository-data.mjs';

const API_BASE_URL = 'https://api.github.com';
const API_VERSION = '2026-03-10';
const PER_PAGE = 100;

export async function loadRepositoryData(token) {
  const userResponse = await githubRequest(`${API_BASE_URL}/user`, token);
  const user = await userResponse.json();

  if (typeof user.login !== 'string' || user.login.length === 0) {
    throw new Error('GitHub did not return a valid authenticated user.');
  }

  const personalRepositories = await fetchAll(
    '/user/repos?affiliation=owner&visibility=all',
    token,
  );
  const organizationRepositories = await loadOrganizationRepositories(token);

  return {
    username: user.login,
    repositories: mergeRepositories(
      personalRepositories,
      organizationRepositories,
    ),
  };
}

async function loadOrganizationRepositories(token) {
  const memberships = await fetchAll(
    '/user/memberships/orgs?state=active',
    token,
  );
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
      token,
    );

    organizationRepositories.push(...repositories);
  }

  return organizationRepositories;
}

function mergeRepositories(personalRepositories, organizationRepositories) {
  const repositoriesById = new Map();

  for (const repo of personalRepositories) {
    const normalized = normalizeRepository(repo, 'user');
    repositoriesById.set(normalized.id, normalized);
  }

  for (const repo of organizationRepositories) {
    const normalized = normalizeRepository(repo, 'organization');
    repositoriesById.set(normalized.id, normalized);
  }

  return [...repositoriesById.values()].sort(compareRepositories);
}

async function fetchAll(path, token) {
  const separator = path.includes('?') ? '&' : '?';
  let nextUrl = `${API_BASE_URL}${path}${separator}per_page=${PER_PAGE}`;
  const items = [];

  while (nextUrl) {
    const response = await githubRequest(nextUrl, token);
    const page = await response.json();

    if (!Array.isArray(page)) {
      throw new Error(`Expected a list from GitHub for ${path}.`);
    }

    items.push(...page);
    nextUrl = getNextPageUrl(response.headers.get('link'));
  }

  return items;
}

async function githubRequest(url, token) {
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
