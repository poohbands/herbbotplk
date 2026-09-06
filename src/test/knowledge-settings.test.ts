import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getKnowledgeSettings,
  saveKnowledgeSettings,
  DEFAULT_KNOWLEDGE_SETTINGS,
  KNOWLEDGE_SETTINGS_EVENT,
} from "../lib/knowledge-settings";

describe("Knowledge Settings Management", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns default settings (both true) when localStorage is empty", () => {
    const settings = getKnowledgeSettings();
    expect(settings).toEqual({
      enable_external_research: true,
      enable_internal_db: true,
    });
    expect(DEFAULT_KNOWLEDGE_SETTINGS.enable_external_research).toBe(true);
    expect(DEFAULT_KNOWLEDGE_SETTINGS.enable_internal_db).toBe(true);
  });

  it("saves and loads enable_external_research toggle correctly", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    const updated = saveKnowledgeSettings({ enable_external_research: false });
    expect(updated.enable_external_research).toBe(false);
    expect(updated.enable_internal_db).toBe(true);

    const reloaded = getKnowledgeSettings();
    expect(reloaded.enable_external_research).toBe(false);
    expect(reloaded.enable_internal_db).toBe(true);

    expect(dispatchSpy).toHaveBeenCalled();
    const eventArg = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(eventArg.type).toBe(KNOWLEDGE_SETTINGS_EVENT);
    expect(eventArg.detail).toEqual({
      enable_external_research: false,
      enable_internal_db: true,
    });
  });

  it("saves and loads enable_internal_db toggle correctly", () => {
    saveKnowledgeSettings({ enable_internal_db: false });

    const reloaded = getKnowledgeSettings();
    expect(reloaded.enable_internal_db).toBe(false);
    expect(reloaded.enable_external_research).toBe(true);
  });

  it("can toggle both settings off and on independently", () => {
    saveKnowledgeSettings({ enable_internal_db: false, enable_external_research: false });
    let current = getKnowledgeSettings();
    expect(current.enable_internal_db).toBe(false);
    expect(current.enable_external_research).toBe(false);

    saveKnowledgeSettings({ enable_external_research: true });
    current = getKnowledgeSettings();
    expect(current.enable_internal_db).toBe(false);
    expect(current.enable_external_research).toBe(true);
  });
});
