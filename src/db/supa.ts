import { createClient } from '@supabase/supabase-js'

let SUPA_URL = process.env.SUPA_URL as string
let SUPA_KEY = process.env.SUPA_KEY as string


export const getSupaClient = async () => {

if (!SUPA_URL || !SUPA_KEY) {
    const dotEnv = await import('dotenv')
    dotEnv.config()
    SUPA_URL = process.env.SUPA_URL as string
    SUPA_KEY = process.env.SUPA_KEY as string
}

return createClient(SUPA_URL, SUPA_KEY)
}
