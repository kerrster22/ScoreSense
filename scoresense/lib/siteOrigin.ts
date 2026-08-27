import { headers } from "next/headers"

/** Best-effort site origin for building absolute redirect URLs from server code. */
export async function siteOrigin(): Promise<string> {
  const headerList = await headers()
  return headerList.get("origin") ?? headerList.get("x-forwarded-host") ?? ""
}
