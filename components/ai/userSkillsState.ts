export interface UserSkillStatusItemLike {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: "ready" | "warning";
}

export interface UserSkillsStatusLike {
  ok: boolean;
  skills?: UserSkillStatusItemLike[];
}

export interface UserSkillOption {
  id: string;
  slug: string;
  name: string;
  description: string;
}

export function getReadyUserSkillOptions(
  status: UserSkillsStatusLike | null | undefined,
): UserSkillOption[] {
  if (!status?.ok || !Array.isArray(status.skills)) return [];

  return status.skills
    .filter((skill) => skill.status === "ready" && typeof skill.slug === "string" && skill.slug.length > 0)
    .map((skill) => ({
      id: skill.id,
      slug: skill.slug,
      name: skill.name,
      description: skill.description,
    }));
}

export function pruneSelectedUserSkillSlugsMap(
  selectedByScope: Record<string, string[]>,
  options: UserSkillOption[],
): Record<string, string[]> {
  const validSlugs = new Set(options.map((option) => option.slug));
  let changed = false;
  const nextEntries: Array<[string, string[]]> = [];

  for (const [scopeKey, slugs] of Object.entries(selectedByScope)) {
    const filteredSlugs = slugs.filter((slug) => validSlugs.has(slug));
    if (filteredSlugs.length !== slugs.length) changed = true;
    if (filteredSlugs.length > 0) {
      nextEntries.push([scopeKey, filteredSlugs]);
    } else if (slugs.length > 0) {
      changed = true;
    }
  }

  if (!changed) {
    return selectedByScope;
  }

  return Object.fromEntries(nextEntries);
}

export function getNextSelectedUserSkillSlugsMap(
  selectedByScope: Record<string, string[]>,
  status: UserSkillsStatusLike | null | undefined,
): Record<string, string[]> {
  if (!status?.ok || !Array.isArray(status.skills)) {
    return selectedByScope;
  }

  return pruneSelectedUserSkillSlugsMap(
    selectedByScope,
    getReadyUserSkillOptions(status),
  );
}
