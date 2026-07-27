# GitHub repository inventory

This script generates a repository inventory in `README.md` containing:

- Repositories owned by your personal GitHub account.
- Repositories owned by organizations where you are an owner.
- Public, private, and internal repositories.
- Repository names, owners, descriptions, archive states, visibility
  settings, and URLs.
- Organizations without repositories, shown with `No repositories.`

## 1. Create a GitHub token

1. Open <https://github.com/settings/tokens>.
2. Select **Tokens (classic)**.
3. Select **Generate new token**, then **Generate new token (classic)**.
4. Give the token a descriptive name, such as
   `pat-repos-YYYY-MM`.
5. Choose an expiration date, maybe a month from now.
6. Select only these scopes:
   - `repo`
   - `read:org`
7. Select **Generate token** and copy the token immediately.

The `repo` scope is required to read private repositories. The `read:org`
scope is required to read organization memberships and identify organizations
where your role is owner/admin.

## 2. Configure the token

From the repository root, copy the sample environment file:

```bash
cp .env.sample .env.local
```

Open `.env.local` and replace the sample value:

```dotenv
GITHUB_TOKEN=ghp_your_actual_token
```

The `.env.local` file is ignored by Git.

## 3. Run the script

Node.js 20.6 or newer is required for `--env-file` support. No dependency
installation or build step is required.

Generate `README.md` using any package runner:

```bash
npm run generate
```

```bash
pnpm run generate
```

```bash
bun run generate
```

You can also run the script directly with Node.js:

```bash
node --env-file=.env.local scripts/generate-repos.mjs
```

The script sends only `GET` requests to GitHub. It follows every pagination
page and includes archived repositories. The personal account appears first,
followed by organizations sorted by name. Repositories are sorted by name
within each owner. Every organization where your role is owner/admin is
listed, including organizations that do not have any repositories.

## Output markers

Repository entries use these markers:

- `A`: archived
- `P`: private
- `I`: internal

Public, active repositories do not have a marker.
