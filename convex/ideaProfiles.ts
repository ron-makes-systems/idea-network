import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const mutation = mutationGeneric;
const query = queryGeneric;

const themeLabels: Record<string, string> = {
  voice: "Student voice",
  curriculum: "Curriculum",
  pay: "Paid youth work",
  belonging: "Belonging",
  arts: "Arts",
  "mental-health": "Mental health",
  community: "Community change",
  future: "Future pathways",
};

const themeStatements: Record<
  string,
  { spark: string; tension: string; oneLiner: string }
> = {
  curriculum: {
    spark: "Students want learning to be designed with their questions, not only delivered to them.",
    tension: "Most schools still define relevance before students get to shape it.",
    oneLiner: "Students should help design what learning becomes.",
  },
  pay: {
    spark: "Young people are already doing serious design, research, and organizing work.",
    tension: "Systems often welcome youth voice without paying for youth labor.",
    oneLiner: "If students do real change work, that work should be valued and paid.",
  },
  belonging: {
    spark: "Students are reaching for a school culture where they feel recognized, not processed.",
    tension: "Institutional structures can flatten the human reality students are trying to protect.",
    oneLiner: "Education should feel like a place students belong inside.",
  },
  voice: {
    spark: "Young people want influence, not just occasional feedback requests.",
    tension: "Too many decisions about learning happen without the people living through it.",
    oneLiner: "Young people should help decide what shapes their everyday learning life.",
  },
  default: {
    spark: "A student sees a local disconnect and wants to make it more alive, fair, and true.",
    tension: "Institutional systems usually need translation before they know how to move.",
    oneLiner: "A student idea can become real when it finds language, people, and a shared direction.",
  },
};

export const submitIdeaProfile = mutation({
  args: {
    name: v.optional(v.string()),
    neighborhood: v.optional(v.string()),
    contact: v.optional(v.string()),
    connectionIntent: v.optional(v.string()),
    dream: v.string(),
    themes: v.array(v.string()),
    pathPreference: v.string(),
  },
  handler: async (ctx, args) => {
    return await insertIdeaProfile(ctx, args);
  },
});

export const seedSampleIdeas = mutation({
  args: {},
  handler: async (ctx) => {
    const sampleProfiles = await ctx.db.query("ideaProfiles").collect();
    const sampleProfileIds = sampleProfiles
      .filter((profile) => isSampleProfile(profile))
      .map((profile) => profile._id);

    if (sampleProfileIds.length > 0) {
      const connections = await ctx.db.query("connections").collect();
      for (const connection of connections) {
        if (
          sampleProfileIds.includes(connection.sourceProfileId) ||
          sampleProfileIds.includes(connection.targetProfileId)
        ) {
          await ctx.db.delete(connection._id);
        }
      }

      for (const profileId of sampleProfileIds) {
        await ctx.db.delete(profileId);
      }
    }

    const samples: SampleDraft[] = [
      {
        name: "Mina (sample)",
        neighborhood: "Nairobi",
        contact: "mina-sample@common-room.test",
        connectionIntent: "Looking for people who want to design a first pilot together.",
        dream:
          "Students should co-design one term of school around problems in their own neighborhoods (sample).",
        themes: ["curriculum", "community"],
        pathPreference: "step",
      },
      {
        name: "Elliot (sample)",
        neighborhood: "Bristol",
        contact: "@elliot-sample",
        connectionIntent: "Open to exchanging questions and building the story further.",
        dream:
          "Every school should have a student-run studio where young people turn local issues into public projects (sample).",
        themes: ["voice", "arts", "community"],
        pathPreference: "story",
      },
      {
        neighborhood: "Sao Paulo",
        dream:
          "Students should be paid to research what makes school feel deadening and help redesign it from the inside (sample).",
        themes: ["pay", "belonging", "voice"],
        pathPreference: "map",
      },
      {
        name: "Aarav (sample)",
        neighborhood: "Delhi",
        dream:
          "Teenagers should build a parallel mentorship web so learning is shaped by peers, craftspeople, and families, not only teachers (sample).",
        themes: ["future", "community", "voice"],
        pathPreference: "map",
      },
      {
        name: "Lucia (sample)",
        neighborhood: "Lisbon",
        contact: "lucia-sample@common-room.test",
        connectionIntent: "Would love to find collaborators in Europe.",
        dream:
          "Students should make their own schools in unused buildings, with adults invited in as supporters instead of managers (sample).",
        themes: ["voice", "curriculum", "community"],
        pathPreference: "story",
      },
      {
        neighborhood: "Seoul",
        contact: "anonymous-link-(sample)",
        connectionIntent: "Happy to talk anonymously for now.",
        dream:
          "School should include weekly time for collective repair: mental health circles, conflict work, and redesigning the culture together (sample).",
        themes: ["mental-health", "belonging", "voice"],
        pathPreference: "step",
      },
      {
        name: "Samira (sample)",
        neighborhood: "Toronto",
        dream:
          "Young people should earn credit and income for teaching one another practical things adults never make room for in school (sample).",
        themes: ["pay", "curriculum", "future"],
        pathPreference: "map",
      },
      {
        name: "Diego (sample)",
        neighborhood: "Mexico City",
        contact: "@diego-builds-(sample)",
        dream:
          "Students should document the education changes they want as films, zines, and public exhibitions so ideas can travel between cities (sample).",
        themes: ["arts", "voice", "community"],
        pathPreference: "story",
      },
    ];

    const inserted = [];
    for (const sample of samples) {
      const result = await insertIdeaProfile(ctx, sample);
      inserted.push(result.profileId);
    }

    return { insertedProfiles: inserted.length };
  },
});

export const getIdeaProfile = query({
  args: { profileId: v.id("ideaProfiles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.profileId);
  },
});

export const getMatchesForProfile = query({
  args: { profileId: v.id("ideaProfiles") },
  handler: async (ctx, args) => {
    const connections = await ctx.db
      .query("connections")
      .withIndex("by_source_profile", (q) => q.eq("sourceProfileId", args.profileId))
      .order("desc")
      .collect();

    const joined = await Promise.all(
      connections.map(async (connection) => {
        const target = await ctx.db.get(connection.targetProfileId);
        if (!target) {
          return null;
        }

        return {
          connectionId: connection._id,
          score: connection.score,
          reasons: connection.reasons,
          bridgeText: connection.bridgeText ?? buildLegacyBridgeText(connection.reasons),
          sharedThemes: (connection.sharedThemes ?? []).map(
            (theme: string) => themeLabels[theme] ?? theme,
          ),
          sharedKeywords: connection.sharedKeywords ?? [],
          samePlace: connection.samePlace ?? false,
          targetDisplayName: target.displayName,
          targetPlaceLabel: target.placeLabel,
          targetIdeaTitle: target.ideaTitle,
          targetDreamExcerpt: target.dreamExcerpt,
          targetOneLiner: target.oneLiner,
          targetConnectionIntent: target.connectionIntent ?? null,
          targetContact: target.contact ?? null,
        };
      }),
    );

    return joined.filter((item) => item !== null);
  },
});

export const listIdeaLandscape = query({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("ideaProfiles").order("desc").take(18);
    return profiles.map((profile) => ({
      _id: profile._id,
      displayName: profile.displayName,
      placeLabel: profile.placeLabel,
      ideaTitle: profile.ideaTitle,
      dreamExcerpt: profile.dreamExcerpt,
      primaryThemeLabel: profile.primaryThemeLabel,
      connectionIntent: profile.connectionIntent ?? null,
    }));
  },
});

export const getCanvasState = query({
  args: { profileId: v.optional(v.id("ideaProfiles")) },
  handler: async (ctx, args) => {
    const profiles = await ctx.db.query("ideaProfiles").order("desc").take(40);
    const activeCounts = await getActiveRoomCounts(ctx);
    const selectedConnections = args.profileId
      ? await ctx.db
          .query("connections")
          .withIndex("by_source_profile", (q) => q.eq("sourceProfileId", args.profileId))
          .collect()
      : [];

    const scoreMap = new Map(
      selectedConnections.map((connection) => [String(connection.targetProfileId), connection.score]),
    );

    return profiles.map((profile, index) => {
      const score = scoreMap.get(String(profile._id)) ?? null;
      const point = args.profileId
        ? canvasPointForSelected(profile, index, args.profileId, score)
        : canvasPointForLandscape(profile, index);

      return {
        _id: profile._id,
        ideaTitle: profile.ideaTitle,
        dreamExcerpt: profile.dreamExcerpt,
        displayName: profile.displayName,
        placeLabel: profile.placeLabel,
        primaryThemeLabel: profile.primaryThemeLabel,
        connectionIntent: profile.connectionIntent ?? null,
        roomCount: activeCounts.get(String(profile._id)) ?? 0,
        score,
        x: point.x,
        y: point.y,
        isSelected: args.profileId ? String(profile._id) === String(args.profileId) : false,
      };
    });
  },
});

export const listCanvasPresence = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query("canvasPresence").collect();
    const now = Date.now();
    return entries
      .filter((entry) => now - entry.lastSeen < PRESENCE_TTL_MS)
      .map((entry) => ({
        sessionId: entry.sessionId,
        displayLabel: entry.displayLabel,
        color: entry.color,
        x: entry.x,
        y: entry.y,
      }));
  },
});

export const updateCanvasPresence = mutation({
  args: {
    sessionId: v.string(),
    displayLabel: v.string(),
    color: v.string(),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("canvasPresence")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayLabel: args.displayLabel,
        color: args.color,
        x: args.x,
        y: args.y,
        lastSeen: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("canvasPresence", {
      sessionId: args.sessionId,
      displayLabel: args.displayLabel,
      color: args.color,
      x: args.x,
      y: args.y,
      lastSeen: Date.now(),
    });
  },
});

export const getIdeaRoomState = query({
  args: { profileId: v.id("ideaProfiles") },
  handler: async (ctx, args) => {
    const idea = await ctx.db.get(args.profileId);
    if (!idea) {
      return null;
    }

    const sessions = await ctx.db
      .query("roomSessions")
      .withIndex("by_idea_profile", (q) => q.eq("ideaProfileId", args.profileId))
      .collect();
    const activeParticipants = sessions
      .filter((session) => Date.now() - session.lastSeen < ROOM_TTL_MS)
      .map((session) => ({
        sessionId: session.sessionId,
        displayLabel: session.displayLabel,
        color: session.color,
      }));

    const messages = await ctx.db
      .query("ideaMessages")
      .withIndex("by_idea_profile", (q) => q.eq("ideaProfileId", args.profileId))
      .collect();

    return {
      idea: {
        _id: idea._id,
        ideaTitle: idea.ideaTitle,
        dreamExcerpt: idea.dreamExcerpt,
        displayName: idea.displayName,
        placeLabel: idea.placeLabel,
      },
      activeParticipants,
      activeCount: activeParticipants.length,
      isFull: activeParticipants.length >= ROOM_CAPACITY,
      messages: messages.map((message) => ({
        _id: message._id,
        authorLabel: message.authorLabel,
        body: message.body,
      })),
    };
  },
});

export const joinIdeaRoom = mutation({
  args: {
    profileId: v.id("ideaProfiles"),
    sessionId: v.string(),
    displayLabel: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("roomSessions")
      .withIndex("by_idea_profile", (q) => q.eq("ideaProfileId", args.profileId))
      .collect();

    const activeSessions = sessions.filter((session) => Date.now() - session.lastSeen < ROOM_TTL_MS);
    const existing = activeSessions.find((session) => session.sessionId === args.sessionId);

    if (!existing && activeSessions.length >= ROOM_CAPACITY) {
      throw new Error("This room is full right now.");
    }

    const anyExisting = sessions.find((session) => session.sessionId === args.sessionId);
    if (anyExisting) {
      await ctx.db.patch(anyExisting._id, {
        displayLabel: args.displayLabel,
        color: args.color,
        lastSeen: Date.now(),
        ideaProfileId: args.profileId,
      });
      return { joined: true };
    }

    await ctx.db.insert("roomSessions", {
      ideaProfileId: args.profileId,
      sessionId: args.sessionId,
      displayLabel: args.displayLabel,
      color: args.color,
      lastSeen: Date.now(),
    });
    return { joined: true };
  },
});

export const leaveIdeaRoom = mutation({
  args: {
    profileId: v.id("ideaProfiles"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("roomSessions")
      .withIndex("by_idea_profile", (q) => q.eq("ideaProfileId", args.profileId))
      .collect();
    const existing = sessions.find((session) => session.sessionId === args.sessionId);
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

export const heartbeatIdeaRoom = mutation({
  args: {
    profileId: v.id("ideaProfiles"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("roomSessions")
      .withIndex("by_idea_profile", (q) => q.eq("ideaProfileId", args.profileId))
      .collect();
    const existing = sessions.find((session) => session.sessionId === args.sessionId);
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeen: Date.now() });
    }
    return null;
  },
});

export const removeDuplicateIdeaProfiles = mutation({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("ideaProfiles").order("desc").collect();
    const seen = new Set<string>();
    const duplicateIds = [];

    for (const profile of profiles) {
      const fingerprint =
        profile.submissionFingerprint ??
        buildSubmissionFingerprint({
          name: profile.name,
          neighborhood: profile.neighborhood,
          contact: profile.contact,
          dream: profile.dream,
        });

      if (seen.has(fingerprint)) {
        duplicateIds.push(profile._id);
      } else {
        seen.add(fingerprint);
      }
    }

    if (duplicateIds.length === 0) {
      return { deletedProfiles: 0, deletedConnections: 0, deletedMessages: 0 };
    }

    const duplicateIdSet = new Set(duplicateIds.map((id) => String(id)));

    const connections = await ctx.db.query("connections").collect();
    let deletedConnections = 0;
    for (const connection of connections) {
      if (
        duplicateIdSet.has(String(connection.sourceProfileId)) ||
        duplicateIdSet.has(String(connection.targetProfileId))
      ) {
        await ctx.db.delete(connection._id);
        deletedConnections += 1;
      }
    }

    const messages = await ctx.db.query("ideaMessages").collect();
    let deletedMessages = 0;
    for (const message of messages) {
      if (duplicateIdSet.has(String(message.ideaProfileId))) {
        await ctx.db.delete(message._id);
        deletedMessages += 1;
      }
    }

    for (const duplicateId of duplicateIds) {
      await ctx.db.delete(duplicateId);
    }

    return {
      deletedProfiles: duplicateIds.length,
      deletedConnections,
      deletedMessages,
    };
  },
});

export const removeNonSampleIdeaProfiles = mutation({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("ideaProfiles").collect();
    const nonSampleIds = profiles
      .filter((profile) => !isSampleProfile(profile))
      .map((profile) => profile._id);

    if (nonSampleIds.length === 0) {
      return { deletedProfiles: 0, deletedConnections: 0, deletedMessages: 0 };
    }

    const nonSampleIdSet = new Set(nonSampleIds.map((id) => String(id)));

    const connections = await ctx.db.query("connections").collect();
    let deletedConnections = 0;
    for (const connection of connections) {
      if (
        nonSampleIdSet.has(String(connection.sourceProfileId)) ||
        nonSampleIdSet.has(String(connection.targetProfileId))
      ) {
        await ctx.db.delete(connection._id);
        deletedConnections += 1;
      }
    }

    const messages = await ctx.db.query("ideaMessages").collect();
    let deletedMessages = 0;
    for (const message of messages) {
      if (nonSampleIdSet.has(String(message.ideaProfileId))) {
        await ctx.db.delete(message._id);
        deletedMessages += 1;
      }
    }

    for (const profileId of nonSampleIds) {
      await ctx.db.delete(profileId);
    }

    return {
      deletedProfiles: nonSampleIds.length,
      deletedConnections,
      deletedMessages,
    };
  },
});

async function createConnectionsForProfile(
  ctx: any,
  sourceProfileId: any,
  input: {
    placeLabel: string;
    neighborhoodKey: string;
    primaryTheme: string;
    themes: string[];
    normalizedKeywords: string[];
    ideaTitle: string;
  },
) {
  const candidatesByTheme = await ctx.db
    .query("ideaProfiles")
    .withIndex("by_primary_theme", (q: any) => q.eq("primaryTheme", input.primaryTheme))
    .collect();

  const candidatesByNeighborhood =
    input.neighborhoodKey === "global"
      ? []
      : await ctx.db
          .query("ideaProfiles")
          .withIndex("by_neighborhood_key", (q: any) => q.eq("neighborhoodKey", input.neighborhoodKey))
          .collect();

  const candidates = dedupeProfiles([...candidatesByTheme, ...candidatesByNeighborhood]).filter(
    (candidate) => candidate._id !== sourceProfileId,
  );

  for (const candidate of candidates) {
    const result = scoreConnection(
      {
        placeLabel: input.placeLabel,
        neighborhoodKey: input.neighborhoodKey,
        primaryTheme: input.primaryTheme,
        themes: input.themes,
        normalizedKeywords: input.normalizedKeywords,
        ideaTitle: input.ideaTitle,
      },
      candidate,
    );

    if (result.score < 25) {
      continue;
    }

    await ctx.db.insert("connections", {
      sourceProfileId,
      targetProfileId: candidate._id,
      score: result.score,
      reasons: result.reasons,
      sharedThemes: result.sharedThemes,
      sharedKeywords: result.sharedKeywords,
      samePlace: result.samePlace,
      bridgeText: result.bridgeText,
    });

    await ctx.db.insert("connections", {
      sourceProfileId: candidate._id,
      targetProfileId: sourceProfileId,
      score: result.score,
      reasons: result.reasons,
      sharedThemes: result.sharedThemes,
      sharedKeywords: result.sharedKeywords,
      samePlace: result.samePlace,
      bridgeText: result.bridgeText,
    });
  }
}

async function insertIdeaProfile(
  ctx: any,
  args: {
    name?: string;
    neighborhood?: string;
    contact?: string;
    connectionIntent?: string;
    dream: string;
    themes: string[];
    pathPreference: string;
  },
) {
  const dream = normalizePhrase(args.dream);
  const themes = args.themes.length > 0 ? args.themes : ["voice"];
  const primaryTheme = pickPrimaryTheme(themes, dream);
  const normalizedKeywords = extractKeywords(dream);
  const name = normalizeOptional(args.name);
  const neighborhood = normalizeOptional(args.neighborhood);
  const contact = normalizeOptional(args.contact);
  const connectionIntent = normalizeOptional(args.connectionIntent);
  const displayName = name ?? (dream.includes("(sample)") ? "Anonymous (sample)" : "Anonymous student");
  const placeLabel = neighborhood ?? "Somewhere in the world";
  const neighborhoodKey = neighborhood ? normalizeKey(neighborhood) : "global";
  const submissionFingerprint = buildSubmissionFingerprint({
    name,
    neighborhood,
    contact,
    dream,
  });
  const narrative = buildNarrative(dream, themes, primaryTheme, displayName);

  const existing = await ctx.db
    .query("ideaProfiles")
    .withIndex("by_submission_fingerprint", (q: any) =>
      q.eq("submissionFingerprint", submissionFingerprint),
    )
    .first();

  if (existing) {
    return { profileId: existing._id, duplicate: true };
  }

  const profileId = await ctx.db.insert("ideaProfiles", {
    name,
    displayName,
    neighborhood,
    placeLabel,
    neighborhoodKey,
    contact,
    connectionIntent,
    dream,
    submissionFingerprint,
    ideaTitle: narrative.ideaTitle,
    dreamExcerpt: narrative.dreamExcerpt,
    themes,
    primaryTheme,
    primaryThemeLabel: themeLabels[primaryTheme] ?? "Local student change",
    pathPreference: args.pathPreference,
    normalizedKeywords,
    storyTitle: narrative.storyTitle,
    encouragement: narrative.encouragement,
    storySpark: narrative.storySpark,
    storyTension: narrative.storyTension,
    oneLiner: narrative.oneLiner,
  });

  await createConnectionsForProfile(ctx, profileId, {
    placeLabel,
    neighborhoodKey,
    primaryTheme,
    themes,
    normalizedKeywords,
    ideaTitle: narrative.ideaTitle,
  });

  return { profileId };
}

export const listMessagesForIdea = query({
  args: { profileId: v.id("ideaProfiles") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("ideaMessages")
      .withIndex("by_idea_profile", (q) => q.eq("ideaProfileId", args.profileId))
      .collect();

    return messages.map((message) => ({
      _id: message._id,
      authorLabel: message.authorLabel,
      body: message.body,
    }));
  },
});

export const postMessageToIdea = mutation({
  args: {
    profileId: v.id("ideaProfiles"),
    authorLabel: v.optional(v.string()),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const body = normalizePhrase(args.body);
    if (!body) {
      return null;
    }

    const sessions = await ctx.db
      .query("roomSessions")
      .withIndex("by_idea_profile", (q) => q.eq("ideaProfileId", args.profileId))
      .collect();
    const activeParticipants = sessions.filter((session) => Date.now() - session.lastSeen < ROOM_TTL_MS);
    if (activeParticipants.length >= ROOM_CAPACITY) {
      throw new Error("This room is full right now.");
    }

    const authorLabel = normalizeOptional(args.authorLabel) ?? "Someone";
    return await ctx.db.insert("ideaMessages", {
      ideaProfileId: args.profileId,
      authorLabel,
      body,
    });
  },
});

function scoreConnection(
  source: {
    placeLabel: string;
    neighborhoodKey: string;
    primaryTheme: string;
    themes: string[];
    normalizedKeywords: string[];
    ideaTitle: string;
  },
  target: {
    placeLabel: string;
    neighborhoodKey: string;
    primaryTheme: string;
    themes: string[];
    normalizedKeywords: string[];
    ideaTitle: string;
  },
) {
  let score = 0;
  const reasons: string[] = [];

  const sharedThemes = source.themes.filter((theme) => target.themes.includes(theme));
  const sharedKeywords = source.normalizedKeywords.filter((keyword) =>
    target.normalizedKeywords.includes(keyword),
  );
  const samePlace =
    source.neighborhoodKey !== "global" &&
    target.neighborhoodKey !== "global" &&
    source.neighborhoodKey === target.neighborhoodKey;

  if (source.primaryTheme === target.primaryTheme) {
    score += 40;
    reasons.push(`Both ideas center ${themeLabels[source.primaryTheme] ?? source.primaryTheme}.`);
  }

  if (sharedThemes.length > 0) {
    score += Math.min(sharedThemes.length * 10, 20);
    reasons.push(`Shared concerns: ${sharedThemes.map((theme) => themeLabels[theme] ?? theme).join(", ")}.`);
  }

  if (samePlace) {
    score += 18;
    reasons.push(`They are rooted in the same place: ${target.placeLabel}.`);
  }

  if (sharedKeywords.length > 0) {
    score += Math.min(sharedKeywords.length * 5, 20);
    reasons.push(`Common language: ${sharedKeywords.slice(0, 4).join(", ")}.`);
  }

  return {
    score: Math.min(score, 95),
    reasons,
    sharedThemes,
    sharedKeywords: sharedKeywords.slice(0, 5),
    samePlace,
    bridgeText: buildBridgeText(source.ideaTitle, target.ideaTitle, sharedThemes, samePlace),
  };
}

function buildNarrative(dream: string, themes: string[], primaryTheme: string, displayName: string) {
  const statement = themeStatements[primaryTheme] ?? themeStatements.default;
  const readableThemes =
    themes.length > 0
      ? themes.map((theme) => themeLabels[theme] ?? theme).join(", ")
      : "local student change";

  return {
    ideaTitle: makeIdeaTitle(dream, primaryTheme),
    dreamExcerpt: shortenText(dream, 190),
    storyTitle: `${displayName}'s idea`,
    encouragement: `This idea already carries a point of view. The system here is only trying to surface the other people who may be protecting something similar.`,
    storySpark: `${shortenText(dream, 160)} ${statement.spark}`,
    storyTension: `${statement.tension} Right now the live threads inside this idea are ${readableThemes}.`,
    oneLiner: statement.oneLiner,
  };
}

function makeIdeaTitle(dream: string, primaryTheme: string) {
  const firstSentence = dream.split(/[.!?]/)[0]?.trim();
  if (firstSentence && firstSentence.length <= 78) {
    return firstSentence;
  }

  const words = (firstSentence || themeStatements[primaryTheme]?.oneLiner || themeStatements.default.oneLiner)
    .split(/\s+/)
    .slice(0, 10)
    .join(" ");

  return words.endsWith(".") ? words.slice(0, -1) : words;
}

function buildBridgeText(
  sourceTitle: string,
  targetTitle: string,
  sharedThemes: string[],
  samePlace: boolean,
) {
  if (sharedThemes.length > 0 && samePlace) {
    return `These ideas are circling the same concerns in the same place. ${sourceTitle} could directly build with ${targetTitle}.`;
  }
  if (sharedThemes.length > 0) {
    return `These ideas are reaching for related changes from different contexts. There is material here for collaboration.`;
  }
  return `These ideas are not identical, but they may still sharpen each other through questions and comparison.`;
}

function buildLegacyBridgeText(reasons: string[]) {
  if (reasons.length === 0) {
    return "These ideas may still have something to offer each other.";
  }
  return reasons.join(" ");
}

function extractKeywords(dream: string) {
  return [
    ...new Set(
      dream
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 4 && !stopWords.has(token)),
    ),
  ].slice(0, 12);
}

function pickPrimaryTheme(themes: string[], dream: string) {
  const loweredDream = dream.toLowerCase();
  if (themes.includes("curriculum")) {
    return "curriculum";
  }
  if (themes.includes("pay")) {
    return "pay";
  }
  if (themes.includes("belonging")) {
    return "belonging";
  }
  if (themes.length > 0) {
    return themes[0];
  }
  if (loweredDream.includes("pay") || loweredDream.includes("paid")) {
    return "pay";
  }
  if (loweredDream.includes("curriculum") || loweredDream.includes("learn")) {
    return "curriculum";
  }
  return "voice";
}

function normalizePhrase(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeOptional(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const normalized = normalizePhrase(value);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeKey(value: string) {
  return normalizePhrase(value).toLowerCase();
}

function shortenText(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function dedupeProfiles<T extends { _id: unknown }>(profiles: T[]) {
  const seen = new Set<string>();
  return profiles.filter((profile) => {
    const key = String(profile._id);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function getActiveRoomCounts(ctx: any) {
  const sessions = await ctx.db.query("roomSessions").collect();
  const counts = new Map<string, number>();
  const now = Date.now();

  for (const session of sessions) {
    if (now - session.lastSeen >= ROOM_TTL_MS) {
      continue;
    }
    const key = String(session.ideaProfileId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function canvasPointForLandscape(profile: { _id: unknown; primaryThemeLabel: string }, index: number) {
  const themeAnchor = themeAnchorMap[profile.primaryThemeLabel] ?? { x: 50, y: 50 };
  const wobble = pseudoRandom(String(profile._id));
  return {
    x: clamp(themeAnchor.x + wobble.x * 14 + (index % 3) * 3, 8, 92),
    y: clamp(themeAnchor.y + wobble.y * 14 + Math.floor(index / 3) * 3, 10, 90),
  };
}

function canvasPointForSelected(
  profile: { _id: unknown; primaryThemeLabel: string },
  index: number,
  selectedId: unknown,
  score: number | null,
) {
  if (String(profile._id) === String(selectedId)) {
    return { x: 50, y: 50 };
  }

  const seed = pseudoRandom(String(profile._id));
  if (score !== null) {
    const angle = seed.angle;
    const radius = 34 - score * 0.22;
    return {
      x: clamp(50 + Math.cos(angle) * radius, 8, 92),
      y: clamp(50 + Math.sin(angle) * radius, 10, 90),
    };
  }

  const ring = 38 + (index % 5) * 5;
  return {
    x: clamp(50 + Math.cos(seed.angle) * ring, 6, 94),
    y: clamp(50 + Math.sin(seed.angle) * ring, 8, 92),
  };
}

function pseudoRandom(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  const angle = (hash % 628) / 100;
  return {
    angle,
    x: ((hash % 200) - 100) / 100,
    y: (((hash / 7) % 200) - 100) / 100,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildSubmissionFingerprint(input: {
  name?: string;
  neighborhood?: string;
  contact?: string;
  dream: string;
}) {
  return [
    normalizeKey(input.name ?? ""),
    normalizeKey(input.neighborhood ?? ""),
    normalizeKey(input.contact ?? ""),
    normalizeKey(input.dream),
  ].join("|");
}

function isSampleProfile(profile: {
  displayName: string;
  ideaTitle: string;
  dream: string;
}) {
  return (
    profile.displayName.includes("(sample)") ||
    profile.ideaTitle.includes("(sample)") ||
    profile.dream.includes("(sample)")
  );
}

const stopWords = new Set([
  "about",
  "because",
  "could",
  "should",
  "would",
  "their",
  "there",
  "where",
  "which",
  "while",
  "students",
  "student",
  "school",
  "local",
  "ideas",
  "dream",
  "they",
  "them",
  "therefore",
  "these",
  "those",
]);

const ROOM_CAPACITY = 20;
const ROOM_TTL_MS = 45_000;
const PRESENCE_TTL_MS = 12_000;

const themeAnchorMap: Record<string, { x: number; y: number }> = {
  "Student voice": { x: 30, y: 34 },
  Curriculum: { x: 62, y: 28 },
  "Paid youth work": { x: 76, y: 52 },
  Belonging: { x: 24, y: 62 },
  Arts: { x: 66, y: 68 },
  "Mental health": { x: 44, y: 76 },
  "Community change": { x: 82, y: 28 },
  "Future pathways": { x: 50, y: 18 },
};

type SampleDraft = {
  name?: string;
  neighborhood?: string;
  contact?: string;
  connectionIntent?: string;
  dream: string;
  themes: string[];
  pathPreference: string;
};
