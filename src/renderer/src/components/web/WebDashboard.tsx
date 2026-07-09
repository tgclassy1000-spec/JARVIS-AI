import { useCallback, useEffect, useState } from 'react';

import type {
  NewsArticle,
  NewsCategory,
  WeatherResponse,
  WebAssistantResponse,
  WebBookmark,
  WebDashboard as WebDashboardData,
  WebSearchResult,
} from '../../../../shared/web/contracts';
import { HudPanel } from '../HudPanel';
import { MarkdownMessage } from '../chat/MarkdownMessage';

function shortDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function WebDashboard() {
  const [dashboard, setDashboard] = useState<WebDashboardData | null>(null);
  const [prompt, setPrompt] = useState('Latest AI news');
  const [answer, setAnswer] = useState<WebAssistantResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('Gemini 2.5 Flash');
  const [searchResults, setSearchResults] = useState<readonly WebSearchResult[]>([]);
  const [weatherLocation, setWeatherLocation] = useState('New York');
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [newsCategory, setNewsCategory] = useState<NewsCategory>('technology');
  const [news, setNews] = useState<readonly NewsArticle[]>([]);
  const [currencyText, setCurrencyText] = useState('1 USD to INR');
  const [currencyResult, setCurrencyResult] = useState('');
  const [status, setStatus] = useState('Web intelligence ready.');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    setDashboard(await window.jarvis.web.dashboard());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : 'Web dashboard refresh failed.');
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const run = async (action: () => Promise<void>, message: string): Promise<void> => {
    setLoading(true);
    try {
      await action();
      await refresh();
      setStatus(message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Web intelligence request failed.');
    } finally {
      setLoading(false);
    }
  };

  const askJarvis = () =>
    run(async () => {
      const result = await window.jarvis.web.ask({ prompt });
      setAnswer(result);
    }, 'Web answer grounded.');

  const search = () =>
    run(async () => {
      const result = await window.jarvis.web.search({ query: searchQuery, limit: 8 });
      setSearchResults(result.results);
    }, 'Search complete.');

  const loadWeather = () =>
    run(async () => {
      setWeather(await window.jarvis.web.weather({ location: weatherLocation, days: 3 }));
    }, 'Weather updated.');

  const loadNews = () =>
    run(async () => {
      const result = await window.jarvis.web.news({ category: newsCategory, limit: 6 });
      setNews(result.articles);
    }, 'News feed updated.');

  const convertCurrency = () =>
    run(async () => {
      const match = /(?:(\d+(?:\.\d+)?)\s*)?([A-Za-z]{3})\s+(?:to|in)\s+([A-Za-z]{3})/.exec(
        currencyText,
      );
      if (!match) {
        setCurrencyResult('Use a format like "25 USD to INR".');
        return;
      }
      const result = await window.jarvis.web.convertCurrency({
        amount: Number(match[1] ?? 1),
        from: match[2]!.toUpperCase(),
        to: match[3]!.toUpperCase(),
      });
      setCurrencyResult(
        `${result.amount} ${result.from} = ${result.converted.toFixed(2)} ${result.to}`,
      );
    }, 'Currency converted.');

  const saveSearchBookmark = (result: WebSearchResult) =>
    run(async () => {
      await window.jarvis.web.saveBookmark({
        kind: 'search',
        title: result.title,
        query: searchQuery,
        url: result.url,
      });
    }, 'Bookmark saved.');

  return (
    <main className="web-shell">
      <HudPanel title="Web Intelligence" eyebrow="MODULE 08">
        <div className="web-command">
          <input
            aria-label="Ask web intelligence"
            value={prompt}
            placeholder="Ask for latest news, weather, currency, time, places, or facts"
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void askJarvis();
            }}
          />
          <button type="button" disabled={loading} onClick={() => void askJarvis()}>
            Ask Web
          </button>
        </div>
        <p className="web-status" role="status">
          {loading ? 'Scanning live intelligence feeds...' : status}
        </p>
        {answer ? (
          <div className="web-answer">
            <span>Intent: {answer.intent}</span>
            <MarkdownMessage content={answer.answer} />
            <div className="web-citations">
              {answer.citations.map((citation) => (
                <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer">
                  {citation.title}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </HudPanel>

      <section className="web-grid">
        <HudPanel title="Search Results" eyebrow="CITATIONS">
          <div className="web-row">
            <input
              aria-label="Web search query"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void search();
              }}
            />
            <button type="button" disabled={loading} onClick={() => void search()}>
              Search
            </button>
          </div>
          <ul className="web-results">
            {searchResults.map((result) => (
              <li key={result.id}>
                <a href={result.url} target="_blank" rel="noreferrer">
                  <strong>{result.title}</strong>
                  <span>{result.snippet}</span>
                </a>
                <button type="button" onClick={() => void saveSearchBookmark(result)}>
                  Bookmark
                </button>
              </li>
            ))}
          </ul>
        </HudPanel>

        <HudPanel title="Weather Panel" eyebrow="OPEN METEO">
          <div className="web-row">
            <input
              aria-label="Weather location"
              value={weatherLocation}
              onChange={(event) => setWeatherLocation(event.target.value)}
            />
            <button type="button" disabled={loading} onClick={() => void loadWeather()}>
              Weather
            </button>
          </div>
          {weather ? (
            <div className="weather-card">
              <strong>{weather.location}</strong>
              <span>
                {weather.current.temperatureCelsius}°C · {weather.current.condition}
              </span>
              <span>Humidity {weather.current.humidityPercent}%</span>
              <span>Wind {weather.current.windKph} kph</span>
              <span>
                Sunrise {weather.forecast[0]?.sunrise ?? 'N/A'} · Sunset{' '}
                {weather.forecast[0]?.sunset ?? 'N/A'}
              </span>
            </div>
          ) : (
            <p className="web-empty">No weather loaded.</p>
          )}
        </HudPanel>

        <HudPanel title="News Cards" eyebrow="HEADLINES">
          <div className="web-row">
            <select
              aria-label="News category"
              value={newsCategory}
              onChange={(event) => setNewsCategory(event.target.value as NewsCategory)}
            >
              {['top', 'technology', 'business', 'sports', 'entertainment', 'science'].map(
                (category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ),
              )}
            </select>
            <button type="button" disabled={loading} onClick={() => void loadNews()}>
              Headlines
            </button>
          </div>
          <ul className="news-cards">
            {news.map((article) => (
              <li key={article.id}>
                <a href={article.url} target="_blank" rel="noreferrer">
                  <strong>{article.title}</strong>
                  <span>
                    {article.source} · {shortDate(article.publishedAt)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </HudPanel>

        <HudPanel title="Currency" eyebrow="RATES">
          <div className="web-row">
            <input
              aria-label="Currency conversion"
              value={currencyText}
              onChange={(event) => setCurrencyText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void convertCurrency();
              }}
            />
            <button type="button" disabled={loading} onClick={() => void convertCurrency()}>
              Convert
            </button>
          </div>
          <p className="web-empty">{currencyResult || 'Use a format like 1 USD to INR.'}</p>
        </HudPanel>

        <HudPanel title="History" eyebrow="RECENT">
          <ul className="web-history">
            {dashboard?.history.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.title}</strong>
                <span>
                  {entry.kind} · {shortDate(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </HudPanel>

        <HudPanel title="Bookmarks" eyebrow="SAVED">
          <BookmarkList
            bookmarks={dashboard?.bookmarks ?? []}
            onDelete={(id) =>
              run(async () => {
                await window.jarvis.web.deleteBookmark(id);
              }, 'Bookmark deleted.')
            }
          />
        </HudPanel>
      </section>
    </main>
  );
}

function BookmarkList({
  bookmarks,
  onDelete,
}: {
  readonly bookmarks: readonly WebBookmark[];
  readonly onDelete: (id: string) => Promise<void>;
}) {
  if (bookmarks.length === 0) return <p className="web-empty">No bookmarks saved.</p>;
  return (
    <ul className="web-history">
      {bookmarks.map((bookmark) => (
        <li key={bookmark.id}>
          {bookmark.url ? (
            <a href={bookmark.url} target="_blank" rel="noreferrer">
              <strong>{bookmark.title}</strong>
            </a>
          ) : (
            <strong>{bookmark.title}</strong>
          )}
          <span>{bookmark.kind}</span>
          <button type="button" onClick={() => void onDelete(bookmark.id)}>
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
