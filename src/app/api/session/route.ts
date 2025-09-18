
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (session.isLoggedIn) {
    return NextResponse.json({
      isLoggedIn: session.isLoggedIn,
      username: session.username,
      role: session.role,
    });
  }
  return NextResponse.json({ isLoggedIn: false });
}
