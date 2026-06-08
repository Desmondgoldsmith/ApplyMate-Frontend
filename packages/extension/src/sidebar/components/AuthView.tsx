const LOGIN_URL =
  import.meta.env.VITE_WEB_LOGIN_URL ?? 'http://localhost:3001/login?source=extension';

type AuthViewProps = {
  onRefresh: () => Promise<void>;
};

export function AuthView({ onRefresh }: AuthViewProps) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-am-bg p-6">
      <div className="w-full max-w-[320px]">
        <h1 className="text-[22px] font-bold text-am-primary">ApplyMate</h1>
        <p className="mt-3 text-[13px] text-am-text-secondary">
          Your AI job search companion
        </p>

        <div className="mt-8 rounded-card border border-am-border bg-am-surface p-5">
          <p className="text-center text-[13px] text-am-text-secondary">
            Connect your ApplyMate account to get started
          </p>

          <button
            type="button"
            className="mt-4 w-full rounded-control bg-am-primary px-5 py-3 text-[14px] font-semibold text-am-bg transition hover:bg-am-primary-hover"
            onClick={() => {
              void chrome.tabs.create({ url: LOGIN_URL });
            }}
          >
            Log in to ApplyMate
          </button>

          <p className="mt-3 text-center text-[12px] text-am-text-muted">
            Already logged in on the dashboard?
          </p>

          <button
            type="button"
            className="mt-2 w-full rounded-control border border-am-border-default px-5 py-2.5 text-[13px] text-am-text-secondary transition hover:border-am-primary/30 hover:text-am-text"
            onClick={() => {
              void onRefresh();
            }}
          >
            Refresh connection
          </button>
        </div>
      </div>
    </div>
  );
}
