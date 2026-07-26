import { TOPIC_CATEGORIES } from './topic-categories.mjs';

export function validateActiveUserRepositories(username, repositories) {
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

export function reportValidationErrors(errors) {
  if (errors.length === 0) {
    return;
  }

  console.error(
    `Found topic errors in ${errors.length} active personal repositories:`,
  );
  console.error(JSON.stringify(errors, null, 2));
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
