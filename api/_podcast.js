export function getDomain( url ) {
    try {
        return new URL( url ).hostname.replace( 'www.', '' )
    } catch {
        return url
    }
}

export async function generatePodcastScript( entries, weekStart, weekEnd ) {
    if ( !process.env.AI_GATEWAY_API_KEY ) return null

    const entrySummaries = entries.map( ( e, i ) => ( {
        rank: i + 1,
        title: e.title,
        domain: getDomain( e.url ),
        submitter: e.submitter_name || 'a teammate',
        bullets: ( e.summary || [] ).slice( 0, 3 ),
    } ) )

    const prompt = `You are writing a short, conversational two-host podcast script for an internal team called WWT Digital. The podcast covers the top AI learnings shared by team members this week (week of ${weekStart}–${weekEnd}).

The two hosts are "Alex" and "Jordan" — professional but warm, like a tech podcast. host1 is Alex, host2 is Jordan.

Rules:
- Alex (host1) opens the show, introduces each article, and closes with a sign-off
- Jordan (host2) gives a brief reaction or observation after each article — one or two sentences, not a summary repeat
- Mention the submitter name and source domain naturally each time — vary the phrasing (e.g. "spotted on", "from", "over on", "via", "published at", "shared from")
- Total script under 300 words
- No filler affirmations like "absolutely", "definitely", "great point", "exactly", "totally"
- Conversational, not a press release

Return ONLY a valid JSON array with no markdown fencing or other text:
[{ "speaker": "host1" | "host2", "text": "..." }, ...]

Entries:
${JSON.stringify( entrySummaries, null, 2 )}`

    const response = await fetch( 'https://ai-gateway.vercel.sh/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify( {
            model: 'anthropic/claude-haiku-4.5',
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }],
        } ),
    } )

    if ( !response.ok ) {
        console.error( '[podcast] script generation failed:', response.status )
        return null
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
    const jsonMatch = raw.match( /\[[\s\S]*\]/ )
    if ( !jsonMatch ) return null

    try {
        const parsed = JSON.parse( jsonMatch[0] )
        return Array.isArray( parsed ) ? parsed : null
    } catch {
        return null
    }
}

export async function generatePodcastAudio( script ) {
    if ( !process.env.ELEVENLABS_API_KEY ) return null

    const host1VoiceId = process.env.ELEVENLABS_HOST1_VOICE_ID || '21m00Tcm4TlvDq8ikWAM' // Rachel
    const host2VoiceId = process.env.ELEVENLABS_HOST2_VOICE_ID || 'ErXwobaYiN019PkySvjV' // Antoni

    const inputs = script.map( ( seg ) => ( {
        text: seg.text,
        voice_id: seg.speaker === 'host1' ? host1VoiceId : host2VoiceId,
    } ) )

    const response = await fetch( 'https://api.elevenlabs.io/v1/text-to-dialogue', {
        method: 'POST',
        headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify( { inputs } ),
    } )

    if ( !response.ok ) {
        const err = await response.text()
        console.error( '[podcast] ElevenLabs error:', response.status, err )
        return null
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from( arrayBuffer )
}
