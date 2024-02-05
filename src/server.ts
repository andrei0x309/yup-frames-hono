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
  HOST
}
  from './utils'
import * as Sentry from "@sentry/node";

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
  'eligible-error-no-fid': './public/signup/yup-signup-no-fid.png'
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


app.get('/images/score/static/:id', async (c) => {
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
    image: `${HOST}/images/score/static/score-base`,
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
      image: `${HOST}/images/score/static/score-error`,
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
    image: `${HOST}/images/score/static/eligible-initial`,
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
      image: `${HOST}/images/score/static/eligible-error-no-fid`,
      postUrl: `${HOST}/frame/eligible`
    }))
  }

  const account = await checkAccount(address)

  if (account) {
    return c.html(frameHtml({
      title: 'Yup Signup',
      description: 'Check if you are eligible for yup with farcaster frame',
      image: `${HOST}/images/score/static/eligible-error-account`,
      postUrl: `${HOST}/frame/eligible`
    }))
  }

  const eligibility = await checkEligibility(address)

  if (eligibility) {
    return c.html(frameHtml({
      title: 'Yup Signup',
      description: 'Check if you are eligible for yup with farcaster frame',
      image: `${HOST}/images/score/static/eligible-yes`,
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
      image: `${HOST}/images/score/static/eligible-no`,
      postUrl: `${HOST}/frame/eligible`
    }))
  }
})


console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})
