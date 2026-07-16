import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_ROUTES = ['/admin']
const LOGIN_ROUTE = '/login'
const CLIENTE_ROUTE = '/cliente/dashboard'

function decodeToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(atob(parts[1]))
  } catch {
    return null
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAdminRoute = ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )

  if (!isAdminRoute) {
    return NextResponse.next()
  }

  const token = request.cookies.get('aaces_token')?.value

  if (!token) {
    const loginUrl = new URL(LOGIN_ROUTE, request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const payload = decodeToken(token)
  if (!payload || payload.role !== 'admin') {
    return NextResponse.redirect(new URL(CLIENTE_ROUTE, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
