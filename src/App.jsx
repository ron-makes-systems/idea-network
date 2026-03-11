import { useEffect, useMemo, useState } from "react";
import { useConvex, useMutation } from "convex/react";
import { anyApi } from "convex/server";
import { flushSync } from "react-dom";

const api = anyApi;

const initialForm = {
  name: "",
  neighborhood: "",
  contact: "",
  connectionIntent: "",
  dream: "",
};

export default function App({ convexEnabled, setupIssue }) {
  if (!convexEnabled) {
    return <SetupMode setupIssue={setupIssue} />;
  }

  return <ConnectedApp />;
}

function ConnectedApp() {
  const convex = useConvex();
  const [stage, setStage] = useState("intro");
  const [form, setForm] = useState(initialForm);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [activeProfile, setActiveProfile] = useState(null);
  const [matches, setMatches] = useState(null);
  const [landscape, setLandscape] = useState(null);
  const [convexIssue, setConvexIssue] = useState(null);

  const submitIdeaProfile = useMutation(api.ideaProfiles.submitIdeaProfile);

  const visibleLandscape = useMemo(() => {
    if (!landscape) {
      return [];
    }

    return landscape.filter((item) => item._id !== activeProfileId).slice(0, 9);
  }, [activeProfileId, landscape]);

  useEffect(() => {
    let cancelled = false;

    async function loadLandscape() {
      try {
        const result = await convex.query(api.ideaProfiles.listIdeaLandscape, {});
        if (!cancelled) {
          setLandscape(result);
          setConvexIssue(null);
        }
      } catch (error) {
        if (!cancelled) {
          setConvexIssue(readConvexIssue(error));
          setLandscape([]);
        }
      }
    }

    loadLandscape();

    return () => {
      cancelled = true;
    };
  }, [convex]);

  useEffect(() => {
    if (!activeProfileId) {
      setActiveProfile(null);
      setMatches(null);
      return;
    }

    let cancelled = false;

    async function loadProfileState() {
      try {
        const [profileResult, matchesResult] = await Promise.all([
          convex.query(api.ideaProfiles.getIdeaProfile, { profileId: activeProfileId }),
          convex.query(api.ideaProfiles.getMatchesForProfile, { profileId: activeProfileId }),
        ]);

        if (!cancelled) {
          setActiveProfile(profileResult);
          setMatches(matchesResult);
          setConvexIssue(null);
        }
      } catch (error) {
        if (!cancelled) {
          setConvexIssue(readConvexIssue(error));
        }
      }
    }

    loadProfileState();

    return () => {
      cancelled = true;
    };
  }, [activeProfileId, convex]);

  if (convexIssue) {
    return <SetupMode setupIssue={convexIssue} />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await submitIdeaProfile({
        name: emptyToUndefined(form.name),
        neighborhood: emptyToUndefined(form.neighborhood),
        contact: emptyToUndefined(form.contact),
        connectionIntent: emptyToUndefined(form.connectionIntent),
        dream: form.dream,
        themes: deriveThemes(form.dream),
        pathPreference: derivePathPreference(form.dream),
      });

      setActiveProfileId(result.profileId);
      transitionTo("links", setStage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="journey-shell">
      <header className="topbar minimal">
        <div>
          <p className="eyebrow">Common room</p>
        </div>
      </header>

      <div className="stage-frame" key={stage}>
        {stage === "intro" && (
          <IntroStage
            landscape={visibleLandscape}
            onBegin={() => transitionTo("write", setStage)}
            onExplore={() => transitionTo("links", setStage)}
          />
        )}

        {stage === "write" && (
          <WriteStage
            form={form}
            isSubmitting={isSubmitting}
            onBack={() => transitionTo("intro", setStage)}
            onSubmit={handleSubmit}
            setForm={setForm}
            showOptionalFields={showOptionalFields}
            setShowOptionalFields={setShowOptionalFields}
          />
        )}

        {stage === "links" && (
          <LinksStage
            activeProfile={activeProfile}
            landscape={visibleLandscape}
            matches={matches}
            onShareIdea={() => transitionTo("write", setStage)}
          />
        )}
      </div>
    </div>
  );
}

function IntroStage({ landscape, onBegin, onExplore }) {
  return (
    <main className="stage-layout intro-layout">
      <section className="hero-panel">
        <h1>Leave an idea here.</h1>
        <p className="lede">It does not need to be finished to find company.</p>

        <div className="hero-actions">
          <button className="primary-button" onClick={onBegin} type="button">
            Leave an idea
          </button>
          <button className="secondary-button" onClick={onExplore} type="button">
            Enter
          </button>
        </div>
      </section>

      <section className="preview-panel">
        <div className="preview-note">
          <p className="note-label">In the room</p>
        </div>

        <div className="idea-wall">
          {landscape?.slice(0, 4).map((idea) => (
            <article className="idea-glimpse" key={idea._id}>
              <p className="glimpse-theme">{idea.primaryThemeLabel}</p>
              <h3>{idea.ideaTitle}</h3>
              {shouldShowExcerpt(idea.ideaTitle, idea.dreamExcerpt) ? (
                <p>{idea.dreamExcerpt}</p>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function WriteStage({
  form,
  isSubmitting,
  onBack,
  onSubmit,
  setForm,
  showOptionalFields,
  setShowOptionalFields,
}) {
  return (
    <main className="stage-layout write-layout">
      <section className="compose-shell">
        <div className="compose-header">
          <button className="ghost-link" onClick={onBack} type="button">
            Back
          </button>
          <h1>Write it before it hardens.</h1>
        </div>

        <form className="compose-form" onSubmit={onSubmit}>
          <label className="dream-field">
            <span>The idea</span>
            <textarea
              value={form.dream}
              onChange={(event) =>
                setForm((current) => ({ ...current, dream: event.target.value }))
              }
              placeholder="Students should help design their own curriculum, and they should be paid for the research, facilitation, and community work that makes that possible."
              rows={11}
              required
            />
          </label>

          <div className="optional-shell">
            <button
              className="secondary-button"
              onClick={() => setShowOptionalFields((current) => !current)}
              type="button"
            >
              {showOptionalFields ? "Hide details" : "Leave a way back"}
            </button>

            {showOptionalFields && (
              <div className="optional-grid">
                <label className="quiet-field">
                  <span>Name</span>
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="ron"
                  />
                </label>

                <label className="quiet-field">
                  <span>Place</span>
                  <input
                    value={form.neighborhood}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, neighborhood: event.target.value }))
                    }
                    placeholder="lisbon"
                  />
                </label>

                <label className="quiet-field">
                  <span>How people can reach you</span>
                  <input
                    value={form.contact}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, contact: event.target.value }))
                    }
                    placeholder="@handle, email, or anything else"
                  />
                </label>

                <label className="quiet-field">
                  <span>If someone resonates, what are you open to?</span>
                  <input
                    value={form.connectionIntent}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        connectionIntent: event.target.value,
                      }))
                    }
                    placeholder="questions, collaboration, building a pilot"
                  />
                </label>
              </div>
            )}
          </div>

          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Listening..." : "See what it touches"}
          </button>
        </form>
      </section>
    </main>
  );
}

function LinksStage({ activeProfile, landscape, matches, onShareIdea }) {
  return (
    <main className="stage-layout links-layout">
      <section className="links-hero">
        <div>
          <h1>See what it touches.</h1>
        </div>
        <button className="primary-button" onClick={onShareIdea} type="button">
          Add idea
        </button>
      </section>

      {activeProfile ? (
        <section className="spotlight-card">
          <p className="note-label">Yours</p>
          <h2>{activeProfile.ideaTitle}</h2>
          {shouldShowExcerpt(activeProfile.ideaTitle, activeProfile.dreamExcerpt) ? (
            <p className="spotlight-copy">{activeProfile.dreamExcerpt}</p>
          ) : null}
          <div className="spotlight-meta">
            <span>{activeProfile.displayName}</span>
            <span>{activeProfile.placeLabel}</span>
            <span>{activeProfile.primaryThemeLabel}</span>
          </div>
        </section>
      ) : (
        <section className="spotlight-card">
          <h2>Nothing selected yet.</h2>
        </section>
      )}

      <section className="linked-grid">
        <div className="linked-column">
          <div className="section-head">
            <p className="note-label">Nearby</p>
          </div>

          {activeProfile && matches === undefined && (
            <p className="empty-copy">Looking for nearby ideas...</p>
          )}

          {activeProfile && matches?.length === 0 && (
            <p className="empty-copy">
              No close links yet. This may be the first clear version of this idea in the room.
            </p>
          )}

          <div className="link-card-stack">
            {(activeProfile ? matches || [] : landscape || []).slice(0, 6).map((item) =>
              activeProfile ? (
                <article className="link-card" key={item.connectionId}>
                  <div className="link-card-head">
                    <div>
                      <p className="glimpse-theme">{item.score}% resonance</p>
                      <h4>{item.targetIdeaTitle}</h4>
                    </div>
                    <p className="card-person">
                      {item.targetDisplayName} · {item.targetPlaceLabel}
                    </p>
                  </div>

                  {shouldShowExcerpt(item.targetIdeaTitle, item.targetDreamExcerpt) ? (
                    <p className="card-excerpt">{item.targetDreamExcerpt}</p>
                  ) : null}
                  <p className="bridge-copy">{item.bridgeText}</p>

                  <div className="chip-row">
                    {item.sharedThemes.map((theme) => (
                      <span className="idea-chip" key={theme}>
                        {theme}
                      </span>
                    ))}
                    {item.sharedKeywords.map((keyword) => (
                      <span className="idea-chip soft" key={keyword}>
                        {keyword}
                      </span>
                    ))}
                  </div>

                  {item.targetConnectionIntent && (
                    <p className="connection-line">
                      Open to: {item.targetConnectionIntent}
                    </p>
                  )}

                  {item.targetContact ? (
                    <p className="connection-line">Reach out: {item.targetContact}</p>
                  ) : (
                    <p className="connection-line muted">This idea is shared anonymously for now.</p>
                  )}
                </article>
              ) : (
                <article className="link-card" key={item._id}>
                  <div className="link-card-head">
                    <div>
                      <p className="glimpse-theme">{item.primaryThemeLabel}</p>
                      <h4>{item.ideaTitle}</h4>
                    </div>
                    <p className="card-person">
                      {item.displayName} · {item.placeLabel}
                    </p>
                  </div>
                  {shouldShowExcerpt(item.ideaTitle, item.dreamExcerpt) ? (
                    <p className="card-excerpt">{item.dreamExcerpt}</p>
                  ) : null}
                  {item.connectionIntent && (
                    <p className="connection-line">Open to: {item.connectionIntent}</p>
                  )}
                </article>
              ),
            )}
          </div>
        </div>

        <aside className="linked-column side">
          <div className="section-head">
            <p className="note-label">Elsewhere</p>
          </div>

          <div className="landscape-board">
            {landscape?.slice(0, 8).map((idea) => (
              <article className="landscape-card" key={idea._id}>
                <p className="glimpse-theme">{idea.primaryThemeLabel}</p>
                <h4>{idea.ideaTitle}</h4>
                {shouldShowExcerpt(idea.ideaTitle, idea.dreamExcerpt) ? (
                  <p>{idea.dreamExcerpt}</p>
                ) : null}
              </article>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function SetupMode({ setupIssue }) {
  return (
    <div className="journey-shell">
      <main className="stage-layout intro-layout">
        <section className="hero-panel">
          <p className="eyebrow">Not connected yet</p>
          <h1>The room is here. The live thread is not.</h1>
          {setupIssue ? <p className="setup-warning">{setupIssue}</p> : null}
        </section>

        <section className="preview-panel">
          <div className="preview-note">
            <p className="note-label">To turn it on</p>
            <p>1. Run `npx convex dev` in this project.</p>
            <p>2. Put `VITE_CONVEX_URL=...` in `.env.local`.</p>
            <p>3. Run `npm run dev`.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

function deriveThemes(dream) {
  const loweredDream = dream.toLowerCase();
  const themes = [];

  if (loweredDream.includes("curriculum") || loweredDream.includes("class")) {
    themes.push("curriculum");
  }
  if (loweredDream.includes("pay") || loweredDream.includes("paid") || loweredDream.includes("stipend")) {
    themes.push("pay");
  }
  if (loweredDream.includes("belong") || loweredDream.includes("culture") || loweredDream.includes("cynicism")) {
    themes.push("belonging");
  }
  if (loweredDream.includes("art") || loweredDream.includes("creative")) {
    themes.push("arts");
  }
  if (loweredDream.includes("mental") || loweredDream.includes("care") || loweredDream.includes("wellbeing")) {
    themes.push("mental-health");
  }
  if (loweredDream.includes("community") || loweredDream.includes("local")) {
    themes.push("community");
  }

  if (themes.length === 0) {
    themes.push("voice");
  }

  return [...new Set(themes)].slice(0, 3);
}

function derivePathPreference(dream) {
  const loweredDream = dream.toLowerCase();
  if (loweredDream.includes("together") || loweredDream.includes("collaborat") || loweredDream.includes("build with")) {
    return "map";
  }
  if (loweredDream.includes("pilot") || loweredDream.includes("start") || loweredDream.includes("test")) {
    return "step";
  }
  return "story";
}

function emptyToUndefined(value) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readConvexIssue(error) {
  if (error instanceof Error) {
    if (error.message.includes("Could not find public function")) {
      return "Convex is connected, but this deployment does not have the latest functions yet. Run `npx convex dev` or deploy the updated backend.";
    }
    return error.message;
  }
  return "Convex is configured, but the live deployment is not ready for this version of the app.";
}

function transitionTo(nextStage, setStage) {
  if (typeof document !== "undefined" && "startViewTransition" in document) {
    document.startViewTransition(() => {
      flushSync(() => setStage(nextStage));
    });
    return;
  }

  setStage(nextStage);
}

function shouldShowExcerpt(title, excerpt) {
  if (!title || !excerpt) {
    return false;
  }

  const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalize(title) !== normalize(excerpt);
}
