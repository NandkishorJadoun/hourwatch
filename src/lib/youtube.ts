export interface YoutubeChannel {
  id: string
  title: string
}

export async function fetchMyChannel(accessToken: string): Promise<YoutubeChannel | null> {
  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=id%2Csnippet&mine=true',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  if (!res.ok) {
    throw new Error(`YouTube API error ${res.status}: ${await res.text()}`)
  }

  const data = (await res.json()) as { items?: Array<{ id: string; snippet?: { title?: string } }> }
  const item = data.items?.[0]

  if (!item) return null

  return { id: item.id, title: item.snippet?.title ?? 'Unknown' }
}