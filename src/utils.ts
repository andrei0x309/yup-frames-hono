import * as fs from 'fs'
import Jimp from 'jimp';
const mime = import('mime')
import { parseEther } from 'viem'

const API_BASE = 'https://api.yup.io'

export const AVAILABLE_FRAMES = {
    FRAME_SCORE: '/frame/score',
    FRAME_ELIGIBILITY: '/frame/eligible',
    FRAME_DONATE: '/frame/donate'
}

export const AVAILABLE_FRAMES_TX = {
    FRAME_DONATE_TX: '/frame/donate-tx'
}

const TESTING = false
export const HOST = TESTING ? `https://fstun.flashsoft.eu` : 'https://yup-frames.cyclic.app'

const BODYHTML = `
    <body style="background-color: #f5f5f5; padding: 0; margin: 0;">
    <h1>Farcaster Frame Repo</h1>
    <p>Available frames:</p>
    <ul>
        <li><a href="${HOST}${AVAILABLE_FRAMES.FRAME_SCORE}">Yup Score</a></li>
        <li><a href="${HOST}${AVAILABLE_FRAMES.FRAME_ELIGIBILITY}">Eligibility</a></li>
        <li><a href="${HOST}${AVAILABLE_FRAMES.FRAME_DONATE}">Donate Frame</a></li>
    </ul>
    </body>
`


export const frameHtml = ({
    title,
    image,
    description,
    postUrl,
    buttons,
    textInput
  }: {
    title?: string
    image: string
    description?: string
    postUrl: string
    buttons?: Array<{
      text: string
      index: number
      redirect: boolean
      link?: string
    }>
    textInput?: {
      placeholder: string
    } | undefined
  }) => {
    const DESCRIPTION = description ? `<meta property="og:description" content="${description}" />` : ''
  
    const BUTTONS = (buttons ?? []).map(({ text, index, redirect, link = '' }) => {
      return redirect
        ? `<meta property="fc:frame:button:${index}" content="${text}" />
      <meta property="fc:frame:button:${index}:action" content="link" />
      <meta property="fc:frame:button:${index}:target" content="${link}" />`
        : `
      <meta property="fc:frame:button:${index}" content="${text}" />
      `
    }).join('\n') ?? ''
  
    const TEXT_INPUT = textInput
      ? `<meta property="fc:frame:input:text" content="${textInput.placeholder}" />`
      : ''
  
    return `
    <!DOCTYPE html>
    <html>
      <head>
      <meta property="og:title" content="${title}" />
      <meta property="og:image" content="${image}" />
      ${DESCRIPTION}
      <meta property="fc:frame" content="vNext" />
      <meta property="fc:frame:image" content="${image}" />
      <meta property="fc:frame:post_url" content="${postUrl}" />
      ${BUTTONS}
      ${TEXT_INPUT}
      </head>
    </html>`
  }
  

export const getImage = async (path: string) => {
    const file = fs.readFileSync(path)
    const mimeLib = (await mime).default
    const type = mimeLib.getType(path)
    return {
        file,
        type
    }
}

export const getYupScoreForAddress = async (address: string) => {
    const req = await fetch(`${API_BASE}/web3-profiles/${address}`);
    const res = await req.json();
    console.log('Yup Score:', res)
    return Number(res?.yupScore).toFixed(2)
}

export const checkAccount = async (address: string): Promise<boolean> => {
    try {
        const reqUser = await fetch(`${API_BASE}/accounts/eth?address=${address}`, {
            headers: {
                'Content-Type': 'application/json'
            }
        })
        return reqUser.status === 200
    } catch (e) {
        return false
    }
}

export const checkEligibility = async (address: string): Promise<boolean> => {
    try {
        const req = await fetch(`${API_BASE}/accounts/sign-up/eligible/${address}`);
        const res = await req.json();
        return res.eligible
    } catch (e) {
        return false
    }
}

export const getScoreImage = async (score: string) => {

    const image = await Jimp.read('./public/yup-score-result.png')
    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK)
    const newImage = await image.print(font, 280, 120, `${score}`)

    const file = await newImage.getBufferAsync(Jimp.MIME_PNG)
    return {
        file,
        type: Jimp.MIME_PNG
    }
}

export const getAddressFromFid = async (fid: string) => {
    const req = await fetch(`https://nemes.farcaster.xyz:2281/v1/verificationsByFid?fid=${fid}`)
    const { messages } = await req.json()
    const address = messages[0]?.data?.verificationAddEthAddressBody?.address
    return address
}

export const sendNativeTokenTx = async (address: string, amount: string, chain: string) => {
    const value = parseEther(amount).toString()

    const chainId = chain.startsWith('0x') ? `eip155:${parseInt(chain, 16)}` : `eip155:${chain}`
    return { 
    chainId,
    method: "eth_sendTransaction",
    params: {
      abi: [],
      to: address,
      data: "0x",
      value,
    }
  }
}