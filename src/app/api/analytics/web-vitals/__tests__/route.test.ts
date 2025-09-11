import { NextRequest } from "next/server";
import { expect } from "@jest/globals";
import { POST } from "../route";

jest.mock("next/server", () => ({
  ...jest.requireActual("next/server"),
  NextResponse: {
    json: jest.fn((data, init) => {
      return {
        json: async () => data,
        status: init?.status || 200,
      };
    }),
  },
}));

describe("API /api/analytics/web-vitals", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 for invalid payloads", async () => {
    const req = { json: async () => ({}) } as unknown as NextRequest;
    // @ts-ignore
    const res = await POST(req);
    const body = await res.json();

  expect(res.status).toEqual(400);
  expect(String(body.error)).toMatch(/Invalid payload/);
  });

  it("accepts valid payloads", async () => {
    const payload = {
      metrics: [
        { name: "LCP", value: 2500, rating: "good" },
        { name: "CLS", value: 0.07, rating: "good" },
      ],
      page: "/",
    };
    const req = { json: async () => payload } as unknown as NextRequest;
    // @ts-ignore
    const res = await POST(req);
    const body = await res.json();

  expect(res.status).toEqual(200);
  expect(Boolean(body.ok)).toBe(true);
  });
});
