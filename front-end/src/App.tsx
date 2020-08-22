import React, { Suspense, Component } from 'react';
import './App.css';
import { VoteAndBallots, Vote, Ballot } from './model/vote';
import { Route, BrowserRouter } from 'react-router-dom';
import { createMuiTheme, MuiThemeProvider } from '@material-ui/core/styles';
import { green } from '@material-ui/core/colors';
import VoteList from './components/vote-list';
import { Typography, Button } from '@material-ui/core';
import { MuiPickersUtilsProvider } from '@material-ui/pickers';
import MomentUtils from '@date-io/moment';
import { saveAs } from 'file-saver';
import { DummyAPIClient } from './model/dummy-api-client';
import VotePage from './components/vote-page';
import { FetchedStateComponent } from './components/fetched-state-component';
import VoteConfirmationPage from './components/vote-confirmation-page';
import { ServerAPIClient } from './model/server-api-client';
import MakeVotePage from './components/make-vote-page';
import MakeVoteConfirmationPage from './components/make-vote-confirmation-page';
import ScrapeCFCPage from './components/scrape-cfc-page';
import BallotTable, { ballotsToCsv } from './components/ballot-table';
import { AuthenticationLevel } from './model/auth';
import SiteAppBar from './components/site-app-bar';
import { UserPreferences, getPreferences, setPreferences } from './model/preferences';
import PreferencesPage from './components/preferences-page';

let currentSeasons: string[] = [];

const theme = createMuiTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: green
  },
});

const apiClient = new ServerAPIClient();
const authenticator = apiClient.authenticator;

type AppState = {
  authLevel: AuthenticationLevel;
  authPage?: JSX.Element;
  userId?: string;
};

class App extends FetchedStateComponent<{}, AppState> {
  getMainClass(): string {
    return ["App", ...currentSeasons].join(" ");
  }

  async fetchState(): Promise<AppState> {
    let authLevel = await authenticator.isAuthenticated();
    if (authLevel === AuthenticationLevel.Unauthenticated) {
      let authPage = await authenticator.createAuthenticationPage();
      return { authLevel, authPage };
    }
    let userId = await authenticator.getUserId();
    return {
      authLevel,
      userId
    };
  }

  onLogOut() {
    authenticator.logOut();
    this.setState({ hasConnected: false });
    this.refetchInitialState();
  }

  renderState(state: AppState): JSX.Element {
    if (state.authLevel === AuthenticationLevel.Unauthenticated) {
      // If we aren't logged in yet, then we'll send the user to
      // an authentication page.
      return <div className={this.getMainClass()}>
        <div className="App-body App-login">
          {state.authPage}
        </div>
      </div>;
    }

    let isAdmin = state.authLevel === AuthenticationLevel.AuthenticatedAdmin;
    return <BrowserRouter>
      <div className={this.getMainClass()}>
        <MuiPickersUtilsProvider utils={MomentUtils}>
          <MuiThemeProvider theme={theme}>
            <SiteAppBar
              onLogOut={this.onLogOut.bind(this)}
              userId={state.userId}
              isAdmin={isAdmin} />
            <div className="App-body">
              <Suspense fallback={<div>Loading...</div>}>
                <Route exact path="/" component={VoteListRoute} />
                <Route exact path="/prefs" component={PreferencesRoute} />
                <Route exact path="/vote/:voteId" component={(props: any) => <VoteRoute isAdmin={isAdmin} {...props} />} />
                <Route exact path="/vote/:voteId/ballots" component={VoteBallotsRoute} />
                {isAdmin && <Route exact path="/admin/make-vote" component={MakeVoteRoute} />}
              </Suspense>
            </div>
          </MuiThemeProvider>
        </MuiPickersUtilsProvider>
      </div>
    </BrowserRouter>;
  }
}

class PreferencesRoute extends Component<{ match: any }, UserPreferences> {
  constructor(props: { match: any }) {
    super(props);
    this.state = getPreferences();
  }

  onChange(preferences: UserPreferences) {
    setPreferences(preferences);
    this.setState(preferences);
  }

  render() {
    return <PreferencesPage preferences={this.state} onChange={this.onChange.bind(this)} />;
  }
}

type VoteListRouteState = {
  active: VoteAndBallots[];
  past: Vote[];
};

class VoteListRoute extends FetchedStateComponent<{ match: any }, VoteListRouteState> {
  async fetchState(): Promise<VoteListRouteState> {
    let activePromise = apiClient.getActiveVotes();
    let allPromise = apiClient.getAllVotes();
    let active = await activePromise;
    let all = await allPromise;
    return {
      active,
      past: all.filter(x => !active.find(y => y.vote.id === x.id))
    };
  }

  renderState(data: VoteListRouteState): JSX.Element {
    return <div>
      {
        data.active.length > 0 ? [
          <Typography variant="h2">Active Votes</Typography>,
          <VoteList votes={data.active} />
        ] : [
          <Typography>No votes are currently active. Check back later!</Typography>,
        ]
      }
      {
        data.past.length > 0 && [
          <Typography variant="h2">Closed Votes</Typography>,
          <VoteList votes={data.past.map(vote => ({ vote, ballots: [] }))} />
        ]
      }
      
    </div>;
  }
}

type VoteRouteState = {
  vote?: VoteAndBallots;
  ballotCast?: boolean;
  ballotId?: string;
};

class VoteRoute extends FetchedStateComponent<{ match: any, history: any, isAdmin: boolean }, VoteRouteState> {
  async fetchState(): Promise<VoteRouteState> {
    let data = await apiClient.getVote(this.props.match.params.voteId);
    return { vote: data, ballotCast: false };
  }

  async onCastBallot(vote: Vote, ballot: Ballot) {
    this.setState({ hasConnected: true, data: { ...this.state.data, ballotCast: true } });
    let response = await apiClient.castBallot(vote.id, ballot);
    if ('error' in response) {
      this.setState({ hasConnected: true, error: response.error });
    } else {
      this.setState({ hasConnected: true, data: { ballotId: response.id, ballotCast: true } });
    }
  }

  async onCancelVote(voteId: string) {
    if (await apiClient.admin.cancelVote(voteId)) {
      this.props.history.push('/');
    }
  }

  renderState(data: VoteRouteState): JSX.Element {
    if (!data.vote && !data.ballotCast) {
      return <div>
        <h1>Error 404</h1>
        Vote with ID '{this.props.match.params.voteId}' not found.
      </div>;
    }

    if (data.vote) {
      return <VotePage
        voteAndBallots={data.vote}
        ballotCast={data.ballotCast}
        isAdmin={this.props.isAdmin}
        onCastBallot={this.onCastBallot.bind(this)}
        onCancelVote={() => this.onCancelVote(data.vote!.vote.id)} />;
    } else {
      return <VoteConfirmationPage ballotId={data.ballotId!} />;
    }
  }
}

class VoteBallotsRoute extends FetchedStateComponent<{ match: any, history: any }, VoteAndBallots | undefined> {
  fetchState(): Promise<VoteAndBallots | undefined> {
    return apiClient.getVote(this.props.match.params.voteId);
  }

  onDownloadBallots() {
    let blob = new Blob([ballotsToCsv(this.state.data!)], {type: "text/csv;charset=utf-8"});
    saveAs(blob, this.state.data?.vote.id + '.csv');
  }

  renderState(data: VoteAndBallots | undefined): JSX.Element {
    if (!data) {
      return <div>
        <h1>Error 404</h1>
        Vote with ID '{this.props.match.params.voteId}' not found.
      </div>;
    }

    return <div>
      <BallotTable voteAndBallots={data} />
      <Button variant="contained" onClick={this.onDownloadBallots.bind(this)} style={{margin: "1em"}}>
        Download as CSV
      </Button>
    </div>;
  }
}

type MakeVoteRouteState = {
  phase: "scraping-cfc" | "editing" | "submitted",
  draftVote?: Vote,
  createdVote?: Vote
};

class MakeVoteRoute extends FetchedStateComponent<{ history: any }, MakeVoteRouteState> {
  async fetchState(): Promise<MakeVoteRouteState> {
    return this.skipInitialStateFetch();
  }

  skipInitialStateFetch(): MakeVoteRouteState {
    return {
      phase: "scraping-cfc"
    };
  }

  async onMakeVote(proposal: Vote) {
    this.setState({ ...this.state, data: { ...this.state.data, phase: "submitted" } });
    try {
      let vote = await apiClient.admin.createVote(proposal);
      this.setState({ ...this.state, data: { ...this.state.data, phase: "submitted", createdVote: vote } });
    } catch (ex) {
      this.setState({ ...this.state, error: ex });
    }
  }

  onSubmitDraft(draft?: Vote) {
    if (!draft) {
      draft = {
          id: 'new-vote',
          name: 'Vote Title',
          description: 'A vote on something.',
          deadline: Date.now() / 1000 + 60 * 60 * 24,
          options: [],
          type: {
              tally: 'first-past-the-post'
          }
      };
    }
    this.setState({ ...this.state, data: { phase: "editing", draftVote: draft } });
  }

  onUpdateDraft(draft: Vote) {
    this.setState({ ...this.state, data: { phase: "editing", draftVote: draft } });
  }

  onScrape(url: string, detectCandidates: boolean): Promise<Vote> {
    return apiClient.admin.scrapeCfc(url, detectCandidates);
  }

  renderState(data: MakeVoteRouteState): JSX.Element {
    if (data.phase === "scraping-cfc") {
      return <ScrapeCFCPage onSubmitDraft={this.onSubmitDraft.bind(this)} scrape={this.onScrape.bind(this)} />;
    }

    if (data.createdVote) {
      return <MakeVoteConfirmationPage voteId={data.createdVote.id} />;
    } else {
      return <MakeVotePage
        draft={data.draftVote!}
        onUpdateDraft={this.onUpdateDraft.bind(this)}
        hasSubmittedVote={data.phase === "submitted"}
        onMakeVote={this.onMakeVote.bind(this)} />;
    }
  }
}

export default App;
