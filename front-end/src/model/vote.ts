/**
 * Represents a candidate. Candidates allow for a more fine-grained
 * view of a vote's "name."
 */
export type Candidate = {
    /**
     * The candidate's name.
     */
    name: string;

    /**
     * The candidate's party affiliation, if any.
     */
    affiliation?: string;
};

/// An option in an active or historical vote.
export type VoteOption = {
    /// A unique identifier for the option.
    id: string;

    /// A user-friendly name for the option.
    name: string;

    /**
     * Gets the list of candidates this option consists of.
     * The first candidate is the main candidate, all others
     * are deputies.
     *
     * This is an optional property that allows for a better-looking
     * presentation of candidates in an election than the standard
     * "name" format.
     */
    ticket?: Candidate[];

    /// A markdown description of what this option entails.
    description: string;
};

/// A type of vote where every voter gets to choose exactly one option.
export type ChooseOneBallotType = {
    tally: "first-past-the-post";
};

/// A type of vote where every voter gets to rate every option.
export type RateOptionsBallotType = {
    tally: "spsv";
    positions: number;
    min: number;
    max: number;
};

export type BallotType = ChooseOneBallotType | RateOptionsBallotType;

export function getBallotKind(ballotType: BallotType): "choose-one" | "rate-options" {
    switch (ballotType.tally) {
        case "first-past-the-post":
            return "choose-one";
        case "spsv":
            return "rate-options";
    }
}

/// An active or historical vote.
export type Vote = {
    /// A unique identifier for the vote.
    id: string;

    /// A user-friendly name for the vote.
    name: string;

    /// A markdown description of what this vote is about.
    description: string;

    /**
     * The point at which the vote started.
     */
    deadline: number;

    /// The vote's type.
    type: BallotType;

    /// A list of all available options in the vote.
    options: VoteOption[];

    /**
     * A list of elected candidates (represented as vote option IDs)
     * that have resigned post-election. After a resignation, ballots
     * must be re-tallied to elect a replacement candidate. Candidates
     * who have been previously elected must of course remain elected.
     *
     * The list of resignations must be ordered in increasing order of
     * resignation time.
     */
    resigned?: string[];
};

/// A ballot for a multiple choice vote.
export type ChooseOneBallot = {
    id?: string;
    timestamp?: number;
    selectedOptionId: string;
};

/// A ballot for a vote where a user gets to rate options.
export type RateOptionsBallot = {
    id?: string;
    timestamp?: number;
    ratingPerOption: { optionId: string, rating: number }[];
};

/// A ballot.
export type Ballot = ChooseOneBallot | RateOptionsBallot;

export type FinishedBallot = Ballot & {
    id: string;
    timestamp: number;
};

/// A vote and all ballots cast for that vote.
export type VoteAndBallots = {
    /// A vote.
    vote: Vote;

    /// All ballots cast so far for `vote`.
    ballots: Ballot[];

    /// A ballot cast by the user, if any.
    ownBallot?: Ballot;
};

/**
 * Tells if a vote is still active.
 */
export function isActive(vote: Vote): boolean {
    return vote.deadline * 1000 > Date.now();
}

/**
 * Finds a list of all vote options that should be on the ballot but aren't.
 * @param ballot A ballot to check.
 * @param vote The vote to which the ballot belongs.
 */
export function findIncompleteOptions(ballot: Ballot | undefined, vote: Vote): VoteOption[] {
    if (!ballot) {
        return vote.options;
    }

    switch (getBallotKind(vote.type)) {
        case "choose-one":
        {
            return [];
        }
        case "rate-options":
        {
            let ratings = (ballot as RateOptionsBallot).ratingPerOption;
            return vote.options.filter(({ id }) => ratings.findIndex(x => x.optionId === id) === -1);
        }
    }
}

/**
 * Checks if a ballot is complete. Only complete ballots can be submitted.
 * @param ballot A ballot to check.
 * @param vote The vote to which the ballot belongs.
 */
export function isCompleteBallot(ballot: Ballot | undefined, vote: Vote): boolean {
    if (!ballot) {
        return false;
    }

    switch (getBallotKind(vote.type)) {
        case "choose-one":
        {
            let optionId = (ballot as ChooseOneBallot).selectedOptionId;
            return vote.options.findIndex(x => x.id === optionId) !== -1;
        }
        case "rate-options":
        {
            let ratings = (ballot as RateOptionsBallot).ratingPerOption;
            for (let { optionId } of ratings) {
                if (vote.options.findIndex(x => x.id === optionId) === -1) {
                    return false;
                }
            }
            for (let { id } of vote.options) {
                if (ratings.findIndex(x => x.optionId === id) === -1) {
                    return false;
                }
            }
            return true;
        }
    }
}

/**
 * Checks if a ballot can be completed automatically.
 * @param ballot A ballot to check.
 * @param vote The vote to which the ballot belongs.
 */
export function isCompletableBallot(ballot: Ballot | undefined, vote: Vote): boolean {
    if (!ballot) {
        return false;
    }

    switch (getBallotKind(vote.type)) {
        case "choose-one":
            return isCompleteBallot(ballot, vote);
        case "rate-options":
            return (ballot as RateOptionsBallot).ratingPerOption.length > 0;
    }
}

/**
 * Completes a partially filled ballot.
 * @param ballot The ballot to complete.
 * @param vote The vote to which the ballot belongs.
 */
export function completeBallot(ballot: Ballot, vote: Vote): Ballot {
    switch (getBallotKind(vote.type)) {
        case "choose-one":
        {
            return ballot;
        }
        case "rate-options":
        {
            let ratings = (ballot as RateOptionsBallot).ratingPerOption;
            let newRatings = [...ratings];
            for (let { id } of vote.options) {
                if (ratings.findIndex(x => x.optionId === id) === -1) {
                    newRatings.push({ optionId: id, rating: (vote.type as RateOptionsBallotType).min });
                }
            }
            return { ...ballot, ratingPerOption: newRatings };
        }
    }
}

export function sortByString<T>(elements: T[], getString: (x: T) => string): T[] {
    return elements.sort((a, b) => {
        let aId = getString(a);
        let bId = getString(b);
        if (aId > bId) { return -1; }
        else if (aId < bId) { return 1; }
        else { return 0; }
    });
}

function max<TItem, TProp>(seq: TItem[], getProp: (x: TItem) => TProp): TItem {
    let result: TItem = seq[0];
    let maxVal: TProp = getProp(seq[0]);
    for (let item of seq.slice(1)) {
        let val = getProp(item);
        if (val > maxVal) {
            result = item;
            maxVal = val;
        }
    }
    return result;
}

function tallyFPTP(voteAndBallots: VoteAndBallots, seats?: number): string[] {
    seats = seats || 1;
    let counts = new Map<string, number>();
    for (let ballot of voteAndBallots.ballots) {
        let fptpBallot = ballot as ChooseOneBallot;
        if (voteAndBallots.vote.resigned
            && voteAndBallots.vote.resigned.includes(fptpBallot.selectedOptionId)) {
            // Don't count ballots for candidates who have resigned.
            continue;
        }

        let prevScore = counts.get(fptpBallot.selectedOptionId) || 0;
        counts.set(fptpBallot.selectedOptionId, prevScore + 1);
    }
    let sortedOptions = voteAndBallots.vote.options.map(x => x.id).sort();
    let results: string[] = [];
    while (results.length < seats) {
        let winner = max(sortedOptions, x => counts.get(x) || 0);
        results.push(winner);
        sortedOptions = sortedOptions.filter(x => x !== winner);
    }
    return results;
}

type KotzePereiraBallot = string[];

/**
 * Applies the Kotze-Pereira transform to a single ballot.
 * @param ballot The ballot to transform.
 * @param type The ballot's type.
 */
function kotzePereira(ballot: RateOptionsBallot, type: RateOptionsBallotType): KotzePereiraBallot[] {
    let virtualBallots: KotzePereiraBallot[] = [];
    for (let i = type.min; i <= type.max; i++) {
        virtualBallots.push(
            ballot.ratingPerOption
                .filter(x => x.rating >= i)
                .map(x => x.optionId));
    }
    return virtualBallots;
}

function tallySPSV(
    voteAndBallots: VoteAndBallots,
    seats?: number,
    preElected?: string[],
    resigned?: string[]): string[] {

    let ballotType = voteAndBallots.vote.type as RateOptionsBallotType;

    // Apply the Kotze-Pareira transform.
    let virtualBallots = voteAndBallots.ballots.flatMap(ballot =>
        kotzePereira(
            ballot as RateOptionsBallot,
            ballotType));

    // Sort the candidates by ID.
    let sortedCandidates = voteAndBallots.vote.options.map(x => x.id).sort();
    if (resigned) {
        // Remove candidates who have resigned.
        sortedCandidates = sortedCandidates.filter(x => !resigned.includes(x));
    }

    // Then allocate seats.
    let seatCount = seats || Math.min(ballotType.positions, sortedCandidates.length);
    let elected = preElected || [];
    while (elected.length < seatCount) {
        let candidateScores = new Map<string, number>();
        for (let ballot of virtualBallots) {
            let notYetElected = ballot.filter(x => elected.indexOf(x) === -1);
            let alreadyElectedCount = ballot.length - notYetElected.length;
            let weight = 1 / (1 + alreadyElectedCount);
            for (let candidateId of notYetElected) {
                let previousScore = candidateScores.get(candidateId) || 0;
                candidateScores.set(candidateId, previousScore + weight);
            }
        }
        let candidates = sortedCandidates.filter(x => elected.indexOf(x) === -1);
        let bestCandidate = max(candidates, x => candidateScores.get(x) || 0);
        elected.push(bestCandidate);
    }

    return elected;
}

export function tally(voteAndBallots: VoteAndBallots, seats?: number): string[] {
    switch (voteAndBallots.vote.type.tally) {
        case "first-past-the-post":
        {
            return tallyFPTP(voteAndBallots, seats);
        }
        case "spsv":
        {
            let result = tallySPSV(voteAndBallots, seats);
            let resigned = voteAndBallots.vote.resigned || [];
            for (let i = 1; i <= resigned.length; i++) {
                // After every ballot, appoint a resignation by running a single-seat
                // election with ballots that are weighted as those who did not resign
                // were already elected.
                let resignedSlice = resigned.slice(0, i);
                result = tallySPSV(
                    voteAndBallots,
                    seats,
                    result.filter(x => !resignedSlice.includes(x)),
                    resignedSlice);
            }
            return result;
        }
    }
}
