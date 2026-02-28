const DEFAULT_TIMEOUT_MS = 12000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 AutonomousFixerMVP/0.1";

export interface FetchPageResult {
  url: string;
  status: number;
  html: string;
}

export async function fetchPage(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<FetchPageResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml"
      },
      redirect: "follow",
      signal: controller.signal
    });

    const html = await response.text();
    return {
      url: response.url,
      status: response.status,
      html
    };
  } finally {
    clearTimeout(timeout);
  }
}
