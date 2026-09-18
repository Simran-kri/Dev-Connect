export async function fetchGithubRepos(username) {
  const response = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=12`
  );

  if (response.status === 404) {
    throw new Error(`No GitHub user found for "${username}".`);
  }
  if (response.status === 403) {
    throw new Error("GitHub's rate limit was hit. Wait a few minutes and try again.");
  }
  if (!response.ok) {
    throw new Error("Couldn't reach GitHub right now. Try again shortly.");
  }

  const repos = await response.json();
  return repos
    .filter((repo) => !repo.fork)
    .map((repo) => ({
      id: repo.id,
      name: repo.name,
      description: repo.description || "",
      url: repo.html_url,
      homepage: repo.homepage || "",
      language: repo.language || "",
      stars: repo.stargazers_count
    }));
}
