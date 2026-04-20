import { NextRequest, NextResponse } from 'next/server'
import { clearAuthCookies } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/api/auth/login', request.url))
  clearAuthCookies(response)
  return response
}
