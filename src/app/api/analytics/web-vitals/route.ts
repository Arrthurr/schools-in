import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Basic validation
    if (!body || !Array.isArray(body.metrics)) {
      return NextResponse.json(
        { error: "Invalid payload: 'metrics' array is required" },
        { status: 400 }
      );
    }

    // In development, log a compact summary
    if (process.env.NODE_ENV !== "production") {
      const summary = body.metrics
        .map((m: any) => `${m.name}:${Math.round(m.value)}(${m.rating})`)
        .join(", ");
      // eslint-disable-next-line no-console
      console.info(`[Web Vitals] ${summary} - page=${body.page}`);
    }

    // NOTE: In production, forward to your analytics/warehouse here.
    // This route intentionally does not persist data to avoid secrets.

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process web vitals" },
      { status: 500 }
    );
  }
}
