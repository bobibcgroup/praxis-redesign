/**
 * An internal page, not linked from the app: the analytics events, styling requests and feedback
 * recorded in this browser, with the measures the team will track once an approved analytics
 * service collects them from everyone. Every figure is counted from real events here; nothing is
 * estimated. Open it at /internal/analytics.
 */
import { useMemo, useState } from "react";
import { EVENTS, localSink, type EventName, type PraxisAnalyticsEvent } from "../../core/analytics";
import { feedbackStore } from "../../core/feedback";
import { requestHistory } from "../../core/service";
import { download } from "../lib/share";
import { useJourney } from "../lib/journeyContext";
import { TextButton } from "../ui/controls";
import { TopBar } from "../ui/TopBar";

function count(events: PraxisAnalyticsEvent[], name: EventName, where?: (e: PraxisAnalyticsEvent) => boolean): number {
  return events.filter((e) => e.eventName === name && (!where || where(e))).length;
}

function rate(part: number, whole: number): string {
  return whole === 0 ? "No data yet" : `${Math.round((part / whole) * 100)}% (${part} of ${whole})`;
}

export function InternalAnalytics() {
  const { href } = useJourney();
  const [events, setEvents] = useState(() => localSink.read());
  const requests = requestHistory.all();
  const feedback = feedbackStore.all();

  const measures = useMemo(() => {
    const results = new Set(events.filter((e) => e.eventName === "results_viewed").map((e) => e.recommendationId)).size;
    const withFeedback = new Set(events.filter((e) => e.eventName === "feedback_submitted" || e.eventName === "recommendation_rejected").map((e) => e.recommendationId)).size;
    const questions = ["venue", "time", "vibe", "spend"] as const;
    return [
      { label: "Journey completion (results shown per occasion chosen)", value: rate(count(events, "results_viewed"), count(events, "occasion_selected")) },
      ...questions.map((q) => ({ label: `Left on the ${q} question`, value: String(count(events, "step_abandoned", (e) => e.properties.question === q)) })),
      { label: "Save rate (saves per results shown)", value: rate(count(events, "look_saved"), count(events, "results_viewed")) },
      { label: "Feedback rate (recommendations with feedback)", value: rate(withFeedback, results) },
      { label: "Check-out rate (check-outs per results shown)", value: rate(count(events, "checkout_initiated"), count(events, "results_viewed")) },
      { label: "Looks opened large", value: String(count(events, "outfit_enlarged")) },
      { label: "Style DNA completion", value: rate(count(events, "style_dna_completed"), count(events, "style_dna_started")) },
      { label: "Error rate (failed requests)", value: rate(count(events, "processing_failed"), count(events, "styling_submitted")) },
      { label: "Return visits", value: String(count(events, "user_returned")) },
    ];
  }, [events]);

  const byName = useMemo(() => {
    const names = Object.keys(EVENTS) as EventName[];
    return names.map((n) => ({ name: n, n: count(events, n) }));
  }, [events]);

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)]">
      <TopBar back={href("")} />
      <main className="mx-auto flex max-w-[880px] flex-col gap-10 px-5 pb-16 pt-4 lg:px-10">
        <div>
          <p className="a-label text-[var(--muted)]">Internal</p>
          <h1 className="a-display mt-3">Analytics in this browser</h1>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-6 text-[var(--muted)]">
            Counted from the events recorded here only, never estimated. {events.length} events, {requests.length} styling requests and {feedback.length} feedback records are stored in this browser.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <TextButton className="-ml-2" onClick={() => download(new Blob([JSON.stringify({ events, requests, feedback }, null, 2)], { type: "application/json" }), "praxis-analytics.json")}>
              Download as JSON
            </TextButton>
            <TextButton
              onClick={() => {
                localSink.clear();
                setEvents([]);
              }}
            >
              Clear events
            </TextButton>
          </div>
        </div>

        <section aria-labelledby="measures">
          <h2 id="measures" className="a-label text-[var(--muted)]">
            Measures
          </h2>
          <dl className="mt-3">
            {measures.map((m) => (
              <div key={m.label} className="a-piece">
                <dt className="text-[15px] leading-6">{m.label}</dt>
                <dd className="a-mono text-[15px]">{m.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="by-event">
          <h2 id="by-event" className="a-label text-[var(--muted)]">
            Events by name
          </h2>
          <dl className="mt-3">
            {byName.map((e) => (
              <div key={e.name} className="a-piece">
                <dt>
                  <span className="a-mono block text-[13px]">{e.name}</span>
                  <span className="block text-[13px] leading-5 text-[var(--muted)]">{EVENTS[e.name].trigger}</span>
                </dt>
                <dd className="a-mono text-[15px]">{e.n}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="recent">
          <h2 id="recent" className="a-label text-[var(--muted)]">
            Latest events
          </h2>
          <ol className="mt-3 flex flex-col">
            {events
              .slice(-40)
              .reverse()
              .map((e) => (
                <li key={e.eventId} className="a-piece">
                  <span className="min-w-0">
                    <span className="a-mono block text-[13px]">{e.eventName}</span>
                    <span className="block break-all text-[12px] leading-4 text-[var(--muted)]">{JSON.stringify({ ...e.properties, recommendationId: e.recommendationId, outfitId: e.outfitId, userId: e.userId })}</span>
                  </span>
                  <span className="a-mono text-[12px] text-[var(--muted)]">{new Date(e.timestamp).toLocaleTimeString("en-GB")}</span>
                </li>
              ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
