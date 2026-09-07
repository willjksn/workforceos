import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import { isPublicPath } from "@/lib/auth/public-paths";

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

export default clerkConfigured
  ? clerkMiddleware(async (auth, request) => {
      if (request.nextUrl.pathname.startsWith("/api/public")) {
        return NextResponse.next();
      }
      if (!isPublicPath(request.nextUrl.pathname)) {
        await auth.protect();
      }
    })
  : function proxy(request: NextRequest) {
      if (!isPublicPath(request.nextUrl.pathname)) {
        return NextResponse.redirect(new URL("/sign-in", request.url));
      }
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|api/public|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/trpc/(.*)",
    "/__clerk/:path*",
  ],
};
