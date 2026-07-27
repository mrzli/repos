export function normalizeRepository(repo) {
  const data = {
    id: repo.id,
    name: repo.name,
    owner: repo.owner?.login,
    description: repo.description,
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
  if (typeof repo.owner !== 'string' || repo.owner.length === 0) {
    missingFields.push('owner');
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
        `'${repo.owner ?? '<unknown>'}/${repo.name ?? '<unknown>'}': ` +
        `${missingFields.join(', ')}.`,
    );
  }
}
