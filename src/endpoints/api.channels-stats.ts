import type { Context } from 'hono'
import { getSupaClient } from '../db/supa'
import type { TChannelStats} from './t-channel-stats'

const TABLE = 'fc-cache'

const endpoint = 'https://api.warpcast.com/v2/all-channels'

const getChannelData = async () => {
    const res = await fetch(endpoint)
    return await res.json() as TChannelStats
}

const calculateStats = (data: TChannelStats) => {
    const channels = data.result.channels
    const avgFollowers = channels.reduce((acc, c) => acc + c.followerCount, 0) / channels.length
    const avgMembers = channels.reduce((acc, c) => acc + c.memberCount, 0) / channels.length
    const totalFollowers = channels.reduce((acc, c) => acc + c.followerCount, 0)
    const totalMembers = channels.reduce((acc, c) => acc + c.memberCount, 0)
    const avgMembersPerFollower = totalMembers / totalFollowers
    const top10ChannelsByFollowers = channels.sort((a, b) => b.followerCount - a.followerCount).slice(0, 10).map(c => `${c.id} - ${c.name} - [${c.followerCount}]`)
    const top10ChannelsByMembers = channels.sort((a, b) => b.memberCount - a.memberCount).slice(0, 10).map(c => `${c.id} - ${c.name} - [${c.memberCount}]`)
    const avgModerators = channels.reduce((acc, c) => acc + c.moderatorFids.length, 0) / channels.length
    const channelCreationGrowth = {
        daily: channels.filter(c => c.createdAt > (Date.now() - 86400000)/1000).length,
        weekly: channels.filter(c => c.createdAt > (Date.now() - 604800000)/1000).length,
        monthly: channels.filter(c => c.createdAt > (Date.now() - 2592000000)/1000).length
    }
    const channelsCreatedByMonth = channels.filter(c => (c.createdAt * 1000) > new Date('2024-01-01').getTime()).reduce((acc, c) => {
        const month = new Date(c.createdAt * 1000).getMonth()
        acc[month + 1] = acc[month + 1] ? acc[month + 1] + 1 : 1
        return acc
    }, {} as Record<string, number>)
    const totalUSDChannelPrice = channels.length * 25

    const stats = {
        totalChannels: channels.length,
        totalUSDChannelPrice,
        avgFollowers,
        avgMembers,
        totalFollowers,
        totalMembers,
        avgMembersPerFollower,
        top10ChannelsByFollowers,
        top10ChannelsByMembers,
        avgModerators,
        channelCreationGrowth,
        channelsCreatedByMonth 
    }
    return stats
}
 
export const getChannelStats = async (c : Context) => {
    const supa = await getSupaClient()
    const { data, error } = await supa
        .from(TABLE)
        .select('*')
        .eq('name', 'channel-stats')
        .single()
    
    if (data === null) {
        
        const channelData = await getChannelData()
        const stats = calculateStats(channelData)
        await supa.from(TABLE).upsert({ name: 'channel-stats', value: stats, updated_at: new Date() })
        // console.log('No data found, fetching', req)
        return c.json(stats)
    } else if (data?.updated_at && (new Date(data.updated_at).getTime() + 3600000) < Date.now()) {
        // console.log('Data is stale, updating')
        getChannelData().then(async channelData => {
            const stats = calculateStats(channelData)
            await supa.from(TABLE).update({ name: 'channel-stats', value: stats, updated_at: new Date() }).eq('name', 'channel-stats')

            // console.log('Data updated', ret)
        })
        return c.json(data.value)
    }
    // console.log('Data is fresh, returning')
    return c.json(data.value)
 
}
 
  