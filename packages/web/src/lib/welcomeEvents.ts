/** Window events that let any part of the dashboard start the welcome tour or the video. */
export const WELCOME_TOUR_START_EVENT = 'careerkite:welcome-tour-start';
export const WALKTHROUGH_VIDEO_OPEN_EVENT = 'careerkite:walkthrough-video-open';

export function startWelcomeTour(): void {
  window.dispatchEvent(new Event(WELCOME_TOUR_START_EVENT));
}

export function openWalkthroughVideo(): void {
  window.dispatchEvent(new Event(WALKTHROUGH_VIDEO_OPEN_EVENT));
}
