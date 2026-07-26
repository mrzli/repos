export function normalizeRepository(repo, ownerType) {
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

export function compareRepositories(left, right) {
  return (
    left.owner.localeCompare(right.owner) ||
    left.name.localeCompare(right.name)
  );
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
