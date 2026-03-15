import { SchoolService } from "./schoolService";
import { CachedSchoolService } from "./cachedSchoolService";

describe("schoolService", () => {
  it("re-exports CachedSchoolService as SchoolService", () => {
    expect(SchoolService).toBe(CachedSchoolService);
  });
});
