# GitHub repository inventory

This script generates a repository inventory in `README.md` containing:

- Repositories owned by your personal GitHub account.
- Repositories owned by organizations where you are an owner.
- Public, private, and internal repositories.
- Repository names, owners, descriptions, topics, archive states, visibility
  settings, and URLs.

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

Node.js 20 or newer is recommended. No dependency installation or build step
is required.

Generate `README.md`:

```bash
node --env-file=.env.local github-repos.mjs
```

The script sends only `GET` requests to GitHub. It follows every pagination
page, validates personal repository topics, includes archived repositories,
and sorts the output by owner and repository name. Repositories with invalid
or missing topics are reported in the terminal and placed in an
`Invalid User Repos` section instead of a topic category.
