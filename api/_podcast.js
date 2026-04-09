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

    const prompt = `You are writing a short, conversational single-host podcast script for an internal team called WWT Digital. The podcast covers the top AI learnings shared by team members this week (week of ${weekStart}–${weekEnd}).

The host is "Alex" — professional but warm, like a tech podcast host.

Rules:
- Open the show, walk through each article, and close with a sign-off
- Mention the submitter name and source domain naturally each time — vary the phrasing (e.g. "spotted on", "from", "over on", "via", "published at", "shared from")
- Total script under 300 words
- No filler affirmations like "absolutely", "definitely", "exactly", "totally"
- Conversational, not a press release

Return ONLY a valid JSON array of segment strings with no markdown fencing or other text:
["...", "...", ...]

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
        if ( !Array.isArray( parsed ) ) return null
        // Normalise — accept either plain strings or {text} objects from the model
        return parsed.map( ( seg ) => ( typeof seg === 'string' ? { text: seg } : { text: seg.text ?? '' } ) )
    } catch {
        return null
    }
}

async function generateVoice( script ) {
    const voiceId = process.env.ELEVENLABS_HOST1_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
    const fullText = script.map( ( seg ) => seg.text ).join( ' ' )

    const response = await fetch( `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify( {
            text: fullText,
            model_id: 'eleven_turbo_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        } ),
    } )

    if ( !response.ok ) {
        const err = await response.text()
        console.error( '[podcast] ElevenLabs error:', response.status, err )
        return null
    }

    return Buffer.from( await response.arrayBuffer() )
}

async function fetchMusicUrl() {
    if ( process.env.PODCAST_MUSIC_URL ) return process.env.PODCAST_MUSIC_URL

    try {
        const res = await fetch(
            'https://ccmixter.org/api/query?f=json&tags=ambient&sort=random&limit=10&lic=to',
            { signal: AbortSignal.timeout( 5000 ) }
        )
        if ( !res.ok ) return null
        const tracks = await res.json()
        const track = tracks.find( ( t ) => t.download_url )
        return track?.download_url ?? null
    } catch {
        return null
    }
}

async function mixWithMusic( voiceBuffer, ffmpegPath, execAsync ) {
    if ( !ffmpegPath ) {
        console.error( '[podcast] ffmpeg binary not found' )
        return voiceBuffer
    }

    const { writeFile, readFile, unlink } = await import( 'fs/promises' )

    const musicUrl = await fetchMusicUrl()
    console.log( '[podcast] music url:', musicUrl || 'none — using brown noise fallback' )

    const ts = Date.now()
    const tmpVoice = `/tmp/podcast-voice-${ts}.mp3`
    const tmpOut = `/tmp/podcast-out-${ts}.mp3`

    await writeFile( tmpVoice, voiceBuffer )

    // lavfi anoisesrc: source params only in -i, filters (lowpass/volume) go in filter_complex
    const musicInput = musicUrl
        ? `-stream_loop -1 -i "${musicUrl}"`
        : `-f lavfi -i anoisesrc=color=brown:r=44100`

    // normalize=0 prevents amix from halving both inputs (default behaviour kills the quiet bg track)
    const bgFilter = musicUrl
        ? `[1:a]volume=0.10,afade=t=in:st=0:d=2[bg]`
        : `[1:a]lowpass=f=400,volume=0.12,afade=t=in:st=0:d=2[bg]`

    const cmd = `"${ffmpegPath}" -i "${tmpVoice}" ${musicInput} -filter_complex "${bgFilter};[0:a][bg]amix=inputs=2:duration=first:normalize=0[out]" -map "[out]" -c:a libmp3lame -q:a 4 "${tmpOut}" -y`

    console.log( '[podcast] running ffmpeg mix' )
    try {
        await execAsync( cmd, { timeout: 60000 } )
        const mixed = await readFile( tmpOut )
        console.log( '[podcast] mix complete, size:', mixed.length )
        return mixed
    } catch ( err ) {
        console.error( '[podcast] ffmpeg mix failed:', err.message, err.stderr )
        return voiceBuffer
    } finally {
        await Promise.all( [unlink( tmpVoice ), unlink( tmpOut )] ).catch( () => {} )
    }
}

export async function generatePodcastAudio( script ) {
    if ( !process.env.ELEVENLABS_API_KEY ) return null

    const voiceBuffer = await generateVoice( script )
    if ( !voiceBuffer ) return null

    const { exec } = await import( 'child_process' )
    const { promisify } = await import( 'util' )
    const { default: ffmpegPath } = await import( 'ffmpeg-static' )
    const execAsync = promisify( exec )

    return mixWithMusic( voiceBuffer, ffmpegPath, execAsync )
}
