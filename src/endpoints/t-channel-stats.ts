export interface TChannelStats {
    result: Result;
}

export interface Result {
    channels: Channel[];
}

export interface Channel {
    id:                           string;
    url:                          string;
    name:                         string;
    description:                  string;
    descriptionMentions:          number[];
    descriptionMentionsPositions: number[];
    imageUrl:                     string;
    headerImageUrl?:              string;
    leadFid:                      number;
    moderatorFids:                number[];
    createdAt:                    number;
    followerCount:                number;
    memberCount:                  number;
    pinnedCastHash?:              string;
    externalLink?:                ExternalLink;
}

export interface ExternalLink {
    title: string;
    url:   string;
}
