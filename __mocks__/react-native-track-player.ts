// Mock implementation of react-native-track-player
export enum State {
  None = 0,
  Ready = 1,
  Playing = 2,
  Paused = 3,
  Stopped = 4,
  Buffering = 6,
  Connecting = 8,
}

export enum Capability {
  Play = 'play',
  Pause = 'pause',
  Stop = 'stop',
  SeekTo = 'seekTo',
  Skip = 'skip',
  SkipToNext = 'skipToNext',
  SkipToPrevious = 'skipToPrevious',
}

let currentState = State.None;
let currentPosition = 0;
let currentDuration = 0;
let currentTrack: any = null;

const TrackPlayer = {
  setupPlayer: jest.fn(async () => {}),
  updateOptions: jest.fn(async () => {}),
  add: jest.fn(async (track: any) => {
    currentTrack = track;
    currentDuration = track.duration || 0;
  }),
  play: jest.fn(async () => {
    currentState = State.Playing;
  }),
  pause: jest.fn(async () => {
    currentState = State.Paused;
  }),
  stop: jest.fn(async () => {
    currentState = State.Stopped;
    currentPosition = 0;
  }),
  reset: jest.fn(async () => {
    currentState = State.None;
    currentPosition = 0;
    currentDuration = 0;
    currentTrack = null;
  }),
  seekTo: jest.fn(async (position: number) => {
    currentPosition = position;
  }),
  getPosition: jest.fn(async () => currentPosition),
  getDuration: jest.fn(async () => currentDuration),
  getState: jest.fn(async () => currentState),
  getTrack: jest.fn(async () => currentTrack),
};

// Test helpers
export const __setPosition = (position: number) => {
  currentPosition = position;
};

export const __setState = (state: State) => {
  currentState = state;
};

export const __getState = () => currentState;

export const __reset = () => {
  currentState = State.None;
  currentPosition = 0;
  currentDuration = 0;
  currentTrack = null;
};

export default TrackPlayer;
