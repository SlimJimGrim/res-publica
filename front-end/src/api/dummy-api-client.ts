import { Authenticator, makeid } from "./auth";
import { DummyAuthenticator } from "./dummy-auth";
import { APIClient, ElectionManagementClient, OptionalAPIClient, OptionalAPI } from "./api-client";
import { Vote, VoteAndBallots, Ballot, isActive, FinishedBallot, VoteOption } from "../model/vote";

/**
 * An API client that fakes all interactions with the server.
 */
export class DummyAPIClient implements APIClient, OptionalAPIClient {
    constructor() {
        this.activeVotes = [
            {
                vote: mockVoteAndBallots,
                ballots: []
            },
            {
                vote: mockVoteAndBallots2,
                ballots: [
                    {
                        id: "dummy",
                        ratingPerOption: [
                            { optionId: "sppidderman", rating: 5 },
                            { optionId: "option-2", rating: 3 },
                            { optionId: "option-1", rating: 2 },
                        ]
                    }
                ]
            }
        ];
        this.electionManagement = new DummyElectionManagementClient(this.activeVotes);
    }

    get optional(): OptionalAPIClient {
        return this;
    }

    /**
     * Gets an authenticator appropriate for this API client.
     */
    get authenticator(): Authenticator {
        return this.auth;
    }

    readonly electionManagement: DummyElectionManagementClient;

    async getActiveVotes(): Promise<VoteAndBallots[]> {
        return this.activeVotes;
    }

    async getAllVotes(): Promise<Vote[]> {
        return this.activeVotes.map(data => data.vote);
    }

    async getVote(id: string): Promise<VoteAndBallots | undefined> {
        let vote = this.activeVotes.find(x => x.vote.id === id);
        if (vote) {
            return vote;
        } else {
            return undefined;
        }
    }

    async castBallot(voteId: string, ballot: Ballot): Promise<FinishedBallot | { error: string; }> {
        let vote = await this.getVote(voteId);
        if (!vote) {
            return { error: `vote with ID ${voteId} does not exist.` };
        }

        let newBallot = {
            ...ballot,
            id: voteId + "/ballot",
            timestamp: Date.now() / 1000
        };
        vote.ownBallot = newBallot;
        return newBallot;
    }

    async getAvailable(): Promise<OptionalAPI[]> {
        return [
            OptionalAPI.registeredVoters
        ];
    }

    async getRegisteredVoters(): Promise<string[]> {
        return this.registeredVoters;
    }

    /**
     * Registers a new voter.
     */
    async addRegisteredVoter(username: string): Promise<{}> {
        this.registeredVoters.push(username);
        return {};
    }

    /**
     * Unregisters an existing voter.
     */
    async removeRegisteredVoter(username: string): Promise<{}> {
        let index = this.registeredVoters.indexOf(username);
        if (index > 0) {
            this.registeredVoters.splice(index, 1);
        }
        return {};
    }

    async upgradeServer(): Promise<{}> {
        return {};
    }

    private auth = new DummyAuthenticator();
    private activeVotes: VoteAndBallots[];
    private registeredVoters: string[] = ["donald-duck"];
}

class DummyElectionManagementClient implements ElectionManagementClient {
    constructor(private activeVotes: VoteAndBallots[]) {
    }

    async cancelVote(voteId: string): Promise<boolean> {
        let index = this.activeVotes.findIndex(x => x.vote.id === voteId);
        if (index >= 0 && isActive(this.activeVotes[index].vote)) {
            this.activeVotes.splice(index, 1);
            return true;
        } else {
            return false;
        }
    }

    async createVote(proposal: Vote): Promise<Vote> {
        let voteId = `vote-${makeid(20)}`;
        let newVote = {
            ...proposal,
            id: voteId
        };
        this.activeVotes.push({ vote: newVote, ballots: [] });
        return newVote;
    }

    async scrapeCfc(url: string, discernCandidates: boolean): Promise<Vote> {
        return mockVoteAndBallots2;
    }

    resign(voteId: string, optionId: string): Promise<Vote | { error: string }> {
        // TODO: implement this
        throw new Error("Method not implemented.");
    }

    addVoteOption(voteId: string, option: VoteOption): Promise<Vote | { error: string }> {
        // TODO: implement this
        throw new Error("Method not implemented.");
    }
}


let mockVoteAndBallots: Vote = {
    id: "mock-vote",
    name: "24th Ballot Initiative",
    description: "We will now vote on **something.**",
    deadline: (Date.now() + 1000 * 60 * 60 * 24) / 1000,
    type: { tally: "first-past-the-post" },
    options: [
        {
            id: "option-1",
            name: "Yes",
            description: "Approve the proposed proposal as proposed by someone at some point, probably."
        },
        {
            id: "option-2",
            name: "No",
            description: "Wow such option two"
        }
    ]
};

let mockVoteAndBallots2: Vote = {
    id: "mock-vote-2",
    name: "44th Presidential Election",
    description: "We will now vote on **something.**",
    deadline: (Date.now() + 1000 * 10) / 1000,
    type: { tally: "spsv", positions: 1, min: 0, max: 5 },
    options: [
        {
            id: "option-1",
            name: "Ronald McDonald",
            description: "Free burgers for everyone."
        },
        {
            id: "option-2",
            name: "Scrooge McDuck",
            description: "Elect me and I'll make you rich!"
        },
        {
            description: "Hiya! I'm sppidderman and this is my statement.\n\nQualifications: I was a senator on r/SimRome from the day it started to the day it ended, I was senator on r/UnitedMemersofReddit for at least 2 terms until it ended, and I have been appointed Director of Advertisement my first week here.\n\nPolicies: \n\n I believe in a Parliamentary System, as it is important to keep people's attention and to switch stuff up once in a while so that interest isn't lost.\n\nIntegration is very important as well as advertising, because 90% of the people who are either on the sub or on the discord aren't participating, and I think there should be a system put in place that can help new members understand how simdem works and get them active. A few months ago when I joined the discord I really wanted to be apart of everything, but it was very overwhelming and intimidating to see all the different channels and everyone talking about stuff I didn't know about so I went inactive. I rejoined recently, simply because I am built different.\n\nThe economy isn't doing well because of the high rates of inflation, which is due to people not having anything to spend money on and people not being taxed. I do believe that tax cycles should be regulated and that there should be a market for the people to buy stuff.\n\nCommunity engagement is essential, and I think that having events all throughout the subreddit and discord is a good way to combat lack of enthusiasm. Things like movie nights and or game nights should be scheduled and should happen at least once a week.\n\nNow the military is a touchy subject, but I believe that there should be some form of protection, and if we abolished it, then other subreddits would take advantage of that and most likely attack us. I believe in an army reserve, so that if a strike on us is imminent or had just happened, we would be able to mobilize and get the troops ready quickly.\n\nSocial reforms are good, as a simulated democracy is such a good idea for a subreddit, and bringing the community's ideals closer to the government is important to keep simdem running.\n\nFinal words:\n\nIf you want someone who can face challenges head on, vote for me, as I promise to help simdem maintain its good side, and help extinguish its bad side.\n\nMonky",
            id: "sppidderman",
            ticket: [{name: "sppidderman", affiliation: "Progressive Party"}, {name: "benitfeet", affiliation: "FUN"}],
            name: "u/sppidderman | Progressive Party"
        },
    ]
};
