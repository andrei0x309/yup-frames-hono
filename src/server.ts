import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  frameHtml,
  getImage,
  getYupScoreForAddress,
  getScoreImage,
  checkAccount,
  checkEligibility,
  getAddressFromFid,
  AVAILABLE_FRAMES,
  AVAILABLE_FRAMES_TX,
  HOST,
  sendNativeTokenTx
}
  from './utils'
import * as Sentry from "@sentry/node";
import { ghHandleProfileIntial, ghHandleProfileFrame, imagesMap as ghImagesMap } from './frames/github-roast'
import { verifyMessage } from './utils'

const port = Number(process.env.PORT) || 4001
const SENTRY_DSN = process.env.SENTRY_DSN || ''

if (SENTRY_DSN) {
  Sentry.init({ dsn: `https://${SENTRY_DSN}` });
}

const logRequest = async (data: any) => {
  Sentry.captureMessage('FRAME_REQUEST', data)
}

const imagesMap = {
  'score-base': './public/yup-score-base.png',
  'score-error': './public/yup-score-error.png',
  'eligible-initial': './public/signup/yup-signup-check.png',
  'eligible-yes': './public/signup/yup-signup-yes.png',
  'eligible-no': './public/signup/yup-signup-no.png',
  'eligible-error-account': './public/signup/yup-signup-error-account.png',
  'eligible-error-no-fid': './public/signup/yup-signup-no-fid.png',
  'donate-initial': './public/donate/donate-initial.png',
  'donate-success': './public/donate/donate-success.png',
  'donate-error': './public/donate/donate-error.png',
} as const

const app = new Hono()

app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 3600,
}))

app.get('/', (c) => {
  return c.html(
    ``
  )
})

app.get('/frame/redirect/yup', (c) => {
  return c.redirect('https://yup.io')
})

app.get('/images/static/gh-frame/:id', async (c) => {
  const id = (c.req.param('id') ?? '1') as keyof typeof ghImagesMap

  if (!ghImagesMap[id]) {
    return await c.text('Not found', 404)
  }

  const { file, type } = await getImage(ghImagesMap[id])
  return new Response(file, {
    headers: {
      'Content-Type': type ?? 'image/webp'
    },
    status: 200
  });
})


app.get('/images/static/:id', async (c) => {
  const id = (c.req.param('id') ?? '1') as keyof typeof imagesMap

  if (!imagesMap[id]) {
    return await c.text('Not found', 404)
  }

  const { file, type } = await getImage(imagesMap[id])
  return new Response(file, {
    headers: {
      'Content-Type': type ?? 'image/png'
    },
    status: 200
  });
})

app.get('/images/score/address/:id', async (c) => {
  const address = c.req.param('id') as string

  const score = await getYupScoreForAddress(address) ?? 0

  const { file, type } = await getScoreImage(score)

  return new Response(file, {
    headers: {
      'Content-Type': type ?? 'image/png'
    },
    status: 200
  });
})

app.get(AVAILABLE_FRAMES.FRAME_SCORE, (c) => {
  return c.html(frameHtml({
    title: 'Yup Score',
    description: 'Get your yup score with farcaster frame',
    image: `${HOST}/images/static/score-base`,
    postUrl: `${HOST}/frame/score`,
    buttons: [
      {
        text: 'Get My Yup Score',
        index: 1,
        redirect: false
      }
    ]
  }))
})

app.post(AVAILABLE_FRAMES.FRAME_SCORE, async (c) => {
  const { untrustedData} = await c.req.json()
  const { fid } = untrustedData
  const address = await getAddressFromFid(fid)

  logRequest({ untrustedData })

  if (!address) {
    return c.html(frameHtml({
      title: 'Yup Score',
      description: 'Get your yup score with farcaster frame',
      image: `${HOST}/images/static/score-error`,
      postUrl: `${HOST}/frame/score`
    }))
  }

  return c.html(frameHtml({
    title: 'Yup Score',
    description: 'Get your yup score with farcaster frame',
    image: `${HOST}/images/score/address/${address}`,
    postUrl: `${HOST}/frame/score`,
  }))
})

app.get(AVAILABLE_FRAMES.FRAME_ELIGIBILITY, async (c) => {
  return c.html(frameHtml({
    title: 'Yup Signup',
    description: 'Check if you are eligible for yup with farcaster frame',
    image: `${HOST}/images/static/eligible-initial`,
    postUrl: `${HOST}/frame/eligible`,
    buttons: [
      {
        text: 'Check Eligibility',
        index: 1,
        redirect: false
      }
    ]
  }))
})

app.post(AVAILABLE_FRAMES.FRAME_ELIGIBILITY, async (c) => {
  const { untrustedData} = await c.req.json()
  const { fid } = untrustedData

  const address = await getAddressFromFid(fid)

  logRequest({ untrustedData })

  if (!address) {
    return c.html(frameHtml({
      title: 'Yup Signup',
      description: 'Check if you are eligible for yup with farcaster frame',
      image: `${HOST}/images/static/eligible-error-no-fid`,
      postUrl: `${HOST}/frame/eligible`
    }))
  }

  const account = await checkAccount(address)

  if (account) {
    return c.html(frameHtml({
      title: 'Yup Signup',
      description: 'Check if you are eligible for yup with farcaster frame',
      image: `${HOST}/images/static/eligible-error-account`,
      postUrl: `${HOST}/frame/eligible`
    }))
  }

  const eligibility = await checkEligibility(address)

  if (eligibility) {
    return c.html(frameHtml({
      title: 'Yup Signup',
      description: 'Check if you are eligible for yup with farcaster frame',
      image: `${HOST}/images/static/eligible-yes`,
      postUrl: `${HOST}/frame/redirect/yup`,
      buttons: [
        {
          text: 'Join Yup',
          index: 1,
          redirect: true
        }
      ]
    }))
  } else {
    return c.html(frameHtml({
      title: 'Yup Signup',
      description: 'Check if you are eligible for yup with farcaster frame',
      image: `${HOST}/images/static/eligible-no`,
      postUrl: `${HOST}/frame/eligible`
    }))
  }
})

app.get(AVAILABLE_FRAMES.FRAME_DONATE, async (c) => {
  const address = '0x01Ca6f13E48fC5E231351bA38e7E51A1a7835d8D'
  const amount = '0.1'
  const chainId = 666666666

  const getTargetUrl = (address: string, amount: string, chainId: number) => {
    return `${HOST}/frame/donate-tx?address=${address}&amount=${amount}&chainId=${chainId}`
  }

  const getFrameUrl = () => `${HOST}${AVAILABLE_FRAMES.FRAME_DONATE}`

  const buttons = [{
    text: 'Donate 0.00001 ETH',
    index: 1,
    redirect: false,
    action: 'tx',
    target: getTargetUrl(address, amount, chainId),
    post_url: getFrameUrl()
  }]

  const html = frameHtml({
    title: 'Donate',
    image: `${HOST}/images/static/donate-initial`,
    postUrl: `${HOST}/frame/donate`,
    buttons
  })
 
  return c.html(html)
})

app.post(AVAILABLE_FRAMES.FRAME_DONATE, async (c) => {

  const { untrustedData } = await c.req.json()
  console.log(untrustedData)
  const { transactionId } = untrustedData

  if (!transactionId) {
    return c.html(frameHtml({
      title: 'Donate',
      image: `${HOST}/images/static/donate-error`,
      postUrl: `${HOST}/frame/donate`
    }))
  }

  return c.html(frameHtml({
    title: 'Donate',
    image: `${HOST}/images/static/donate-success`,
    postUrl: `${HOST}/frame/donate`
  }))

  // logRequest({ untrustedData })

})

app.post(AVAILABLE_FRAMES_TX.FRAME_DONATE_TX, async (c) => {
   console.log(await c.req.json())

   const { address, amount, chainId } = c.req.query()
   const json = await sendNativeTokenTx(address, amount, chainId)
  console.log(json)

   return c.json(json)
})

app.get('/frame/github-roast', ghHandleProfileIntial)
app.post('/frame/github-roast', ghHandleProfileIntial)
app.post('/frame/github-roast-generate', ghHandleProfileFrame)
app.post('/frame/github-roast/:profile', ghHandleProfileFrame)
app.get('/frame/github-roast/:profile', ghHandleProfileFrame)


app.post('/verify-message', async (c) => {
  const body = await c.req.json()
  await verifyMessage(body)
  return c.json({ status: 'ok' })
})

app.get('/log', async (c) => {
  console.log('log get')

  const json = {
    "type":"composer",
    "name":"MiniApp",
    "icon":"book",
    "description": "MiniApp Link",
    "imageUrl":"https://paragraph.xyz/branding/logo_no_text.png",
    "aboutUrl":"https://yup.live/changelog",
    "action":{"type":"post"}
  }

  return c.json(json)
})

app.post('/log', async (c) => {
  const body = await c.req.json()
  const query = c.req.query()
  console.log(query)
  console.log(body)
  return c.json({ status: 'ok' })
})

console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})
