/**
 * Tests for M365 sync matching behavior: provider gets all schools that match
 * (by name or groupAliases), and assignments are removed only when no match.
 * Uses the same matching logic as syncUserFromM365 without invoking Firestore.
 */

import { locationMatchesGroup } from "../utils";

// Replicate the sync matching loop so we can assert on outcomes
function runMatching(
  allLocations: Array<{
    id: string;
    name: string;
    assignedProviders: string[];
    groupAliases: string[];
  }>,
  schoolGroupNames: string[]
): {
  matchedLocationIds: Set<string>;
  uniqueMatchedLocations: Array<{ id: string; name: string; matchedBy?: "name" | "alias" }>;
} {
  const matchedLocations: Array<{
    id: string;
    name: string;
    matchedBy?: "name" | "alias";
  }> = [];

  for (const loc of allLocations) {
    for (const groupName of schoolGroupNames) {
      const result = locationMatchesGroup(
        { id: loc.id, name: loc.name, groupAliases: loc.groupAliases },
        groupName
      );
      if (result.match) {
        matchedLocations.push({
          id: loc.id,
          name: loc.name,
          matchedBy: result.matchedBy,
        });
        break;
      }
    }
  }

  const seenIds = new Set<string>();
  const uniqueMatchedLocations = matchedLocations.filter((loc) => {
    if (seenIds.has(loc.id)) return false;
    seenIds.add(loc.id);
    return true;
  });

  const matchedLocationIds = new Set(uniqueMatchedLocations.map((l) => l.id));
  return { matchedLocationIds, uniqueMatchedLocations };
}

describe("sync matching behavior", () => {
  test("provider gets both schools when one matches by name and one by alias", () => {
    const allLocations = [
      {
        id: "st-sabina-academy",
        name: "St. Sabina Academy",
        assignedProviders: [] as string[],
        groupAliases: [],
      },
      {
        id: "hope-excel-id",
        name: "HOPE Excel Academy",
        assignedProviders: [] as string[],
        groupAliases: ["HOPE Excel"],
      },
    ];
    const schoolGroupNames = ["St. Sabina Academy", "HOPE Excel"];

    const { matchedLocationIds, uniqueMatchedLocations } = runMatching(
      allLocations,
      schoolGroupNames
    );

    expect(matchedLocationIds.size).toBe(2);
    expect(matchedLocationIds.has("st-sabina-academy")).toBe(true);
    expect(matchedLocationIds.has("hope-excel-id")).toBe(true);
    expect(uniqueMatchedLocations).toHaveLength(2);
    const hopeMatch = uniqueMatchedLocations.find((l) => l.id === "hope-excel-id");
    expect(hopeMatch?.matchedBy).toBe("alias");
    const stSabinaMatch = uniqueMatchedLocations.find((l) => l.id === "st-sabina-academy");
    expect(stSabinaMatch?.matchedBy).toBe("name");
  });

  test("old assignments are removed only when no canonical/alias match exists", () => {
    const allLocations = [
      {
        id: "current-school",
        name: "Current School",
        assignedProviders: ["user-1"],
        groupAliases: [],
      },
      {
        id: "removed-school",
        name: "Old School No Longer In M365",
        assignedProviders: ["user-1"],
        groupAliases: [],
      },
    ];
    const schoolGroupNames = ["Current School"]; // user no longer in "Old School" group

    const { matchedLocationIds } = runMatching(allLocations, schoolGroupNames);

    expect(matchedLocationIds.has("current-school")).toBe(true);
    expect(matchedLocationIds.has("removed-school")).toBe(false);
    // In the real sync, "removed-school" would be in currentlyAssignedLocations
    // and not in matchedLocationIds, so user would be removed from it.
  });
});
