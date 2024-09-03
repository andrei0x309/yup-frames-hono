import { frameHtml, HOST, verifyMessage } from '../utils'
import { getSupaClient  } from '../db/supa'
import type { Context } from 'hono'
import type { T_FRAME_API_BODY } from '../types'
import Jimp from 'jimp';



const FID_LIMIT = 10;
const DAILY_LIMIT = 100;
const TABLE = 'frame-github-roast'
const FNT = './public/github/BP03304.TTF/N0gAexmDkV8rEAhiXcPC0Jno.TTF.fnt'
const GH_POXY = 'https://api-gh-username.deno.dev'

const getcastIntent = (profile: string) => {
    const message = `Roast GitHub profiles, 10 roasts per FID.\nThis is the Roast of ${profile}\n`
    const emebd = `${HOST}/frame/github-roast/${profile}`
    return `https://warpcast.com/~/compose?text=${encodeURI(message)}&embeds[]=${emebd}`

}

const redirectAuthor = (index: number) => ({
    text: 'Author',
    index,
    redirect: true,
    link: 'https://warpcast.com/andrei0x309'
})

const redirectShare = (index: number, profile: string) => ({
    text: 'Share This Roast',
    index,
    redirect: true,
    link: getcastIntent(profile)
})

export const imagesMap = {
    'base_init': './public/github/base_init.webp',
    'error_roast_not_found': './public/github/error_roast_not_found.webp',
    'error_invalid_gh_profile': './public/github/error_invalid_gh_profile.webp',
    'error_author': './public/github/error_author.webp',
    'error_loading': './public/github/error_loading.webp',
    'error_to_many_roasts_fid': './public/github/error_to_many_roasts_fid.webp',
    'error_to_many_roasts': './public/github/error_to_many_roasts.webp',
  } as const

export const generateNewRoast = async (githubProfile: string) => {
    try {
    const req = await fetch("https://github-roast.pages.dev/llama", {
        "headers": {
          "accept": "*/*",
          "accept-language": "en-US,en;q=0.5",
          "cache-control": "no-cache",
          "content-type": "application/json",
          "pragma": "no-cache",
          "priority": "u=1, i",
          "sec-ch-ua": "\"Chromium\";v=\"128\", \"Not;A=Brand\";v=\"24\", \"Brave\";v=\"128\"",
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": "\"Windows\"",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "sec-gpc": "1",
          "Referer": "https://github-roast.pages.dev/?ref=dailydev",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "Origin": "https://github-roast.pages.dev",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
        },
        "body": JSON.stringify({
            username: githubProfile,
            language: "english"
            }),
        "method": "POST"
      })
     
        const data = await req.json()
        return data.roast

    } catch (e) {
        console.error(e)
        return null
    }
}

const getGlobalRoastCount = async () => {
    const supaDB = await getSupaClient()
    const oneDay = 24 * 60 * 60 * 1000
    const count = (await supaDB.from(TABLE).select('id').gt('created_at', new Date(Date.now() - oneDay).toISOString())).count
    return count ?? 0
}

const getCountByFid = async (fid: string) => {
    const supaDB = await getSupaClient()
    const count = (await supaDB.from(TABLE).select('id').eq('fid', fid)).count
    return count ?? 0
}


const getRoastByProfile = async (githubProfile: string) => {
    const supaDB = await getSupaClient()
    const roast = await supaDB.from(TABLE).select('roast').eq('username', githubProfile)
    return roast.data?.[0]?.roast ?? null
}

const checkGHUsernameExists = async (username: string) => {
    try {
        const req = await fetch(GH_POXY, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
    })
    const data = await req.json()

    const exists = data?.id ? true : false

    if (!exists) {
        console.error(data)
        return false
    }

    return true
    
    } catch (e) {
        console.error(e)
        return false
    }
}

const getRoastImage = async (roast: string) => {

    const image = await Jimp.read('./public/github/base.png')
    const font = await Jimp.loadFont(FNT)

    const maxCharsPerLine = 90
    const words = roast.split(' ')
    const lines = []
    let line = ''
    for (let i = 0; i < words.length; i++) {
        if (line.length + words[i].length < maxCharsPerLine) {
            line += ` ${words[i]}`
        } else {
            lines.push(line)
            line = words[i]
        }
    }
    lines.push(line)

    let offset = 0
    let printImage = image
    for (const line of lines) {
        printImage = await printImage.print(font, 18, 68 + offset, line)
        offset += 20
    }
    // const newImage = await image.print(font, 10, 120, `${roast}`)

    return (await printImage.getBase64Async(Jimp.MIME_PNG))
}

export const ghHandleProfileIntial = async (c : Context) => {
    return c.html(frameHtml({
        title: 'Roast',
        image: `${HOST}/images/static/gh-frame/base_init`,
        postUrl: `${HOST}/frame/github-roast-generate`,
        textInput: {
            placeholder: 'Enter Github Profile',
        },
        buttons: [
            {
                text: 'ROAST',
                index: 1,
                redirect: false
            },
            redirectAuthor(2)
        ]
    }))
}
export const ghHandleProfileFrame = async (c : Context) => {
    const supaDB = await getSupaClient()
    let profile = c.req.param('profile')
    let fid
    let castHash
    let text 
    const isPost = c.req.method === 'POST'

 
    if (isPost) {
        const body = (await c.req.json()) as T_FRAME_API_BODY
        const { untrustedData } = body
        await verifyMessage(body)
        fid = untrustedData.fid
        castHash = untrustedData.castId.hash
        text = untrustedData.inputText
        profile = profile ?? text
    }
 
 
    if (profile.toLocaleLowerCase() === 'andrei0x309') {
        return c.html(frameHtml({
            title: 'Error',
            image: `${HOST}/images/static/gh-frame/error_author`,
            postUrl: `${HOST}/frame/github-roast`,
            buttons: [
                {
                    text: 'Try another profile',
                    index: 1,
                    redirect: false
                },
                redirectAuthor(2)
            ]
        }))
    }

    const exists = await checkGHUsernameExists(profile)

    if (!exists) {
        return c.html(frameHtml({
            title: 'Error',
            image:  `${HOST}/images/static/gh-frame/error_invalid_gh_profile`,
            postUrl: `${HOST}/frame/github-roast`,
            buttons: [
                {
                    text: 'Try another profile',
                    index: 1,
                    redirect: false
                },
                redirectAuthor(2)
            ]
        }))
    }

    if (isPost) {
    const roastCount = await getGlobalRoastCount()
    if (roastCount >= DAILY_LIMIT) {
        return c.html(frameHtml({
            title: 'Daily limit reached',
            image: `${HOST}/images/static/gh-frame/error_to_many_roasts`,
            postUrl: `${HOST}/frame/github-roast`,
            buttons: [
                {
                    text: 'Try again later',
                    index: 1,
                    redirect: false
                },
                redirectAuthor(2)
            ]
        }))
    }
    }

    if (isPost) {
    const countByFid = await getCountByFid((fid as number).toString())

    if (countByFid >= FID_LIMIT) {
        return c.html(frameHtml({
            title: 'Daily limit reached',
            image: `${HOST}/images/static/gh-frame/error_to_many_roasts_fid`,
            postUrl: `${HOST}/frame/github-roast`,
            buttons: [
                redirectAuthor(1)
            ]
        }))
    }
 }

    let roast = await getRoastByProfile(profile ?? '')

    if (!isPost && !roast) {
        return c.html(frameHtml({
            title: 'Roast',
            image: `${HOST}/images/static/gh-frame/error_roast_not_found`,
            postUrl: `${HOST}/frame/github-roast`,
            buttons: [
                {
                    text: 'Roast Another Profile',
                    index: 1,
                    redirect: false,
                },
                redirectShare(2, profile ?? ''),
                redirectAuthor(3)
            ]
        }))

    }

    if (!roast) {
        roast = generateNewRoast(profile ?? '')
        const timeoutPromise = new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve(null)
            }, 3500)
        })
        const result = await Promise.race([roast, timeoutPromise])

        if (!result) {
            return c.html(frameHtml({
                title: 'Error loading',
                image: `${HOST}/images/static/gh-frame/error_loading`,
                postUrl: `${HOST}/frame/github-roast${profile ? `/${profile}` : ''}?page=loading`,
                buttons: [
                    {
                        text: 'Check if generated',
                        index: 1,
                        redirect: false
                    },
                    redirectAuthor(2)
                ]
            }))
        }


        await supaDB.from(TABLE).upsert({ roast: result, username: profile, fid, cast_hash: castHash })

        roast = result
    }
    
    const image = await getRoastImage(roast)

    return c.html(frameHtml({
        title: 'Roast',
        image,
        postUrl: `${HOST}/frame/github-roast`,
        buttons: [
            {
                text: isPost ? 'Roast Another Profile' : 'Roast some mfer',
                index: 1,
                redirect: false,
            },
            redirectShare(2, profile ?? ''),
            redirectAuthor(3)
        ]
    }))

}
 
  