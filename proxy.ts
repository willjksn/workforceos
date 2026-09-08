import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import { isPublicPath } from "@/lib/auth/public-paths";

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

function redirectToSignIn(request: NextRequest) {
  const signIn = new URL("/sign-in", request.url);
  const returnPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (returnPath && returnPath !== "/sign-in") {
    signIn.searchParams.set("redirect_url", returnPath);
  }
  return NextResponse.redirect(signIn);
}

export default clerkConfigured
  ? clerkMiddleware(async (auth, request) => {
      if (request.nextUrl.pathname.startsWith("/api/public")) {
        return NextResponse.next();
      }
      if (isPublicPath(request.nextUrl.pathname)) {
        return NextResponse.next();
      }
      const { userId } = await auth();
      if (!userId) {
        return redirectToSignIn(request);
      }
    })
  : function proxy(request: NextRequest) {
      if (!isPublicPath(request.nextUrl.pathname)) {
        return redirectToSignIn(request);
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
