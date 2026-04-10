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

The host is "Alex" — professional but warm, like a tech podcast host. Alex doesn't say his name in the podcast though.

Rules:
- Open the show, walk through each article, and close with a sign-off
- The sign off should mention the d-ai-learnings-hub (say the dashes aloud) slack channel and the "AI Learnings Hub" slack app to submit links or search for what folks are posting.
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
    // SSML <break> tags insert ~2s pauses between entries; ElevenLabs turbo_v2 supports these
    // Replace the channel name with a phonetic version so TTS says the dashes aloud
    const fullText = script
        .map( ( seg ) => seg.text.replace( /d-ai-learnings-hub/gi, 'd dash ai dash learnings dash hub' ) )
        .join( ' <break time="2s"/> ' )

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
        let hint = ''
        try {
            const body = await response.json()
            const status = body?.detail?.status
            if ( status === 'quota_exceeded' ) hint = 'monthly character quota exceeded'
            else if ( status === 'invalid_api_key' ) hint = 'invalid API key'
            else if ( body?.detail?.message ) hint = body.detail.message
        } catch { /* ignore parse errors */ }
        const label = hint ? `: ${hint}` : ''
        console.error( '[podcast] ElevenLabs error:', response.status, hint )
        throw new Error( `ElevenLabs ${response.status}${label}` )
    }

    return Buffer.from( await response.arrayBuffer() )
}

async function fetchMusicUrl() {
    if ( process.env.PODCAST_MUSIC_URL ) return process.env.PODCAST_MUSIC_URL

    try {
        const res = await fetch(
            'https://ccmixter.org/api/query?f=json&tags=electronic,instrumental&sort=random&limit=10&lic=to',
            { signal: AbortSignal.timeout( 5000 ) }
        )
        if ( res.ok ) {
            const tracks = await res.json()
            const track = tracks.find( ( t ) => t.download_url )
            if ( track?.download_url ) return track.download_url
        }
    } catch {
        // fall through to bundled track
    }

    // Bundled royalty-free fallback (api/_music/background.mp3, relative to this file)
    // fileURLToPath decodes %20 etc. so the shell path has real spaces
    const { fileURLToPath } = await import( 'url' )
    return fileURLToPath( new URL( './_music/background.mp3', import.meta.url ) )
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

    // normalize=0 prevents amix from halving both inputs (default kills quiet bg track)
    // adelay=4000  — 4s music intro before voice starts
    // apad=pad_dur=3 — 3s silence appended to voice so music continues after speech ends
    // areverse,afade=t=in:d=2,areverse — fades out the last 2s without needing to know total duration
    const musicInput = `-stream_loop -1 -i "${musicUrl}"`
    const filterComplex = `[0:a]adelay=4000|4000,apad=pad_dur=3[v];[1:a]volume=0.06,afade=t=in:st=0:d=4[bg];[v][bg]amix=inputs=2:duration=first:normalize=0[mixed];[mixed]areverse,afade=t=in:st=0:d=2,areverse[out]`

    const cmd = `"${ffmpegPath}" -i "${tmpVoice}" ${musicInput} -filter_complex "${filterComplex}" -map "[out]" -c:a libmp3lame -q:a 4 "${tmpOut}" -y`

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

    // Fetch usage info after voice generation so it reflects the just-used characters
    let usage = null
    try {
        const subRes = await fetch( 'https://api.elevenlabs.io/v1/user/subscription', {
            headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
        } )
        if ( subRes.ok ) {
            const sub = await subRes.json()
            usage = {
                used: sub.character_count,
                limit: sub.character_limit,
                resetAt: sub.next_character_count_reset_unix,
            }
        }
    } catch { /* non-fatal — audio still returns */ }

    const { exec } = await import( 'child_process' )
    const { promisify } = await import( 'util' )
    const { default: ffmpegPath } = await import( 'ffmpeg-static' )
    const execAsync = promisify( exec )

    const audio = await mixWithMusic( voiceBuffer, ffmpegPath, execAsync )
    return { audio, usage }
}
