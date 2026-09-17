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

  it("returns default settings (all true) when localStorage is empty", () => {
    const settings = getKnowledgeSettings();
    expect(settings).toEqual({
      enable_external_research: true,
      enable_internal_db: true,
      enable_mahidol_ddi: true,
      enable_tu_ddi: true,
      enable_herb_books: true,
      show_verifiable_sources: true,
      show_apa_citations: true,
    });
    expect(DEFAULT_KNOWLEDGE_SETTINGS.enable_external_research).toBe(true);
    expect(DEFAULT_KNOWLEDGE_SETTINGS.enable_internal_db).toBe(true);
    expect(DEFAULT_KNOWLEDGE_SETTINGS.enable_mahidol_ddi).toBe(true);
    expect(DEFAULT_KNOWLEDGE_SETTINGS.enable_tu_ddi).toBe(true);
    expect(DEFAULT_KNOWLEDGE_SETTINGS.enable_herb_books).toBe(true);
    expect(DEFAULT_KNOWLEDGE_SETTINGS.show_verifiable_sources).toBe(true);
    expect(DEFAULT_KNOWLEDGE_SETTINGS.show_apa_citations).toBe(true);
  });

  it("saves and loads enable_external_research toggle correctly", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    const updated = saveKnowledgeSettings({ enable_external_research: false });
    expect(updated.enable_external_research).toBe(false);
    expect(updated.enable_internal_db).toBe(true);
    expect(updated.enable_mahidol_ddi).toBe(true);
    expect(updated.enable_tu_ddi).toBe(true);
    expect(updated.enable_herb_books).toBe(true);
    expect(updated.show_verifiable_sources).toBe(true);
    expect(updated.show_apa_citations).toBe(true);

    const reloaded = getKnowledgeSettings();
    expect(reloaded.enable_external_research).toBe(false);
    expect(reloaded.enable_internal_db).toBe(true);
    expect(reloaded.enable_mahidol_ddi).toBe(true);
    expect(reloaded.enable_tu_ddi).toBe(true);
    expect(reloaded.enable_herb_books).toBe(true);
    expect(reloaded.show_verifiable_sources).toBe(true);
    expect(reloaded.show_apa_citations).toBe(true);

    expect(dispatchSpy).toHaveBeenCalled();
    const eventArg = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(eventArg.type).toBe(KNOWLEDGE_SETTINGS_EVENT);
    expect(eventArg.detail).toEqual({
      enable_external_research: false,
      enable_internal_db: true,
      enable_mahidol_ddi: true,
      enable_tu_ddi: true,
      enable_herb_books: true,
      show_verifiable_sources: true,
      show_apa_citations: true,
    });
  });

  it("saves and loads enable_internal_db toggle correctly", () => {
    saveKnowledgeSettings({ enable_internal_db: false });

    const reloaded = getKnowledgeSettings();
    expect(reloaded.enable_internal_db).toBe(false);
    expect(reloaded.enable_external_research).toBe(true);
    expect(reloaded.enable_mahidol_ddi).toBe(true);
    expect(reloaded.enable_tu_ddi).toBe(true);
    expect(reloaded.enable_herb_books).toBe(true);
    expect(reloaded.show_verifiable_sources).toBe(true);
    expect(reloaded.show_apa_citations).toBe(true);
  });

  it("saves and loads enable_mahidol_ddi toggle correctly", () => {
    saveKnowledgeSettings({ enable_mahidol_ddi: false });

    const reloaded = getKnowledgeSettings();
    expect(reloaded.enable_mahidol_ddi).toBe(false);
    expect(reloaded.enable_external_research).toBe(true);
    expect(reloaded.enable_internal_db).toBe(true);
    expect(reloaded.enable_tu_ddi).toBe(true);
    expect(reloaded.enable_herb_books).toBe(true);
    expect(reloaded.show_verifiable_sources).toBe(true);
    expect(reloaded.show_apa_citations).toBe(true);
  });

  it("saves and loads enable_tu_ddi toggle correctly", () => {
    saveKnowledgeSettings({ enable_tu_ddi: false });

    const reloaded = getKnowledgeSettings();
    expect(reloaded.enable_tu_ddi).toBe(false);
    expect(reloaded.enable_external_research).toBe(true);
    expect(reloaded.enable_internal_db).toBe(true);
    expect(reloaded.enable_mahidol_ddi).toBe(true);
    expect(reloaded.enable_herb_books).toBe(true);
    expect(reloaded.show_verifiable_sources).toBe(true);
    expect(reloaded.show_apa_citations).toBe(true);
  });

  it("saves and loads enable_herb_books toggle correctly", () => {
    saveKnowledgeSettings({ enable_herb_books: false });

    const reloaded = getKnowledgeSettings();
    expect(reloaded.enable_herb_books).toBe(false);
    expect(reloaded.enable_external_research).toBe(true);
    expect(reloaded.enable_internal_db).toBe(true);
    expect(reloaded.enable_mahidol_ddi).toBe(true);
    expect(reloaded.enable_tu_ddi).toBe(true);
    expect(reloaded.show_verifiable_sources).toBe(true);
    expect(reloaded.show_apa_citations).toBe(true);
  });

  it("saves and loads show_verifiable_sources toggle correctly", () => {
    saveKnowledgeSettings({ show_verifiable_sources: false });

    const reloaded = getKnowledgeSettings();
    expect(reloaded.show_verifiable_sources).toBe(false);
    expect(reloaded.show_apa_citations).toBe(true);
    expect(reloaded.enable_herb_books).toBe(true);
    expect(reloaded.enable_external_research).toBe(true);
    expect(reloaded.enable_internal_db).toBe(true);
    expect(reloaded.enable_mahidol_ddi).toBe(true);
    expect(reloaded.enable_tu_ddi).toBe(true);
  });

  it("saves and loads show_apa_citations toggle correctly", () => {
    saveKnowledgeSettings({ show_apa_citations: false });

    const reloaded = getKnowledgeSettings();
    expect(reloaded.show_apa_citations).toBe(false);
    expect(reloaded.show_verifiable_sources).toBe(true);
    expect(reloaded.enable_herb_books).toBe(true);
    expect(reloaded.enable_external_research).toBe(true);
    expect(reloaded.enable_internal_db).toBe(true);
    expect(reloaded.enable_mahidol_ddi).toBe(true);
    expect(reloaded.enable_tu_ddi).toBe(true);
  });

  it("can toggle all settings off and on independently", () => {
    saveKnowledgeSettings({
      enable_internal_db: false,
      enable_external_research: false,
      enable_mahidol_ddi: false,
      enable_tu_ddi: false,
      enable_herb_books: false,
      show_verifiable_sources: false,
      show_apa_citations: false,
    });
    let current = getKnowledgeSettings();
    expect(current.enable_internal_db).toBe(false);
    expect(current.enable_external_research).toBe(false);
    expect(current.enable_mahidol_ddi).toBe(false);
    expect(current.enable_tu_ddi).toBe(false);
    expect(current.enable_herb_books).toBe(false);
    expect(current.show_verifiable_sources).toBe(false);
    expect(current.show_apa_citations).toBe(false);

    saveKnowledgeSettings({ show_verifiable_sources: true, show_apa_citations: true });
    current = getKnowledgeSettings();
    expect(current.show_verifiable_sources).toBe(true);
    expect(current.show_apa_citations).toBe(true);
    expect(current.enable_herb_books).toBe(false);
    expect(current.enable_internal_db).toBe(false);
  });
});
