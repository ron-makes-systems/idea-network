import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ideaProfiles: defineTable({
    name: v.optional(v.string()),
    displayName: v.string(),
    neighborhood: v.optional(v.string()),
    placeLabel: v.string(),
    neighborhoodKey: v.string(),
    contact: v.optional(v.string()),
    connectionIntent: v.optional(v.string()),
    dream: v.string(),
    submissionFingerprint: v.optional(v.string()),
    ideaTitle: v.string(),
    dreamExcerpt: v.string(),
    themes: v.array(v.string()),
    primaryTheme: v.string(),
    primaryThemeLabel: v.string(),
    pathPreference: v.string(),
    normalizedKeywords: v.array(v.string()),
    storyTitle: v.string(),
    encouragement: v.string(),
    storySpark: v.string(),
    storyTension: v.string(),
    oneLiner: v.string(),
  })
    .index("by_primary_theme", ["primaryTheme"])
    .index("by_neighborhood_key", ["neighborhoodKey"])
    .index("by_submission_fingerprint", ["submissionFingerprint"]),

  ideaMessages: defineTable({
    ideaProfileId: v.id("ideaProfiles"),
    authorLabel: v.string(),
    body: v.string(),
  }).index("by_idea_profile", ["ideaProfileId"]),

  roomSessions: defineTable({
    ideaProfileId: v.id("ideaProfiles"),
    sessionId: v.string(),
    displayLabel: v.string(),
    color: v.string(),
    lastSeen: v.number(),
  })
    .index("by_idea_profile", ["ideaProfileId"])
    .index("by_session_id", ["sessionId"]),

  canvasPresence: defineTable({
    sessionId: v.string(),
    displayLabel: v.string(),
    color: v.string(),
    x: v.number(),
    y: v.number(),
    lastSeen: v.number(),
  }).index("by_session_id", ["sessionId"]),

  connections: defineTable({
    sourceProfileId: v.id("ideaProfiles"),
    targetProfileId: v.id("ideaProfiles"),
    score: v.number(),
    reasons: v.array(v.string()),
    sharedThemes: v.array(v.string()),
    sharedKeywords: v.array(v.string()),
    samePlace: v.boolean(),
    bridgeText: v.string(),
  })
    .index("by_source_profile", ["sourceProfileId"])
    .index("by_target_profile", ["targetProfileId"]),
});
