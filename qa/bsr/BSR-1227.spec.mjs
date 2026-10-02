import { test, expect } from "../fixtures.mjs";

// This app's console baseline from step 0d (stable substring).
const BASELINE = ["WebSocket connection to 'wss://jbarlcajqpbzbhvbxaci.supabase.co/realtime/v1/websocket"];

test.describe("BSR-1227 Live Walkthrough: ask which job before recording", () => {
  test("Walkthrough with no job asks 'Which job is this?' and opens the stage hub after picking", async ({ page, shot, newConsoleErrors }) => {
    await page.goto("/atlas");
    await page.waitForLoadState("networkidle");
    await shot("start");

    await page.getByRole("tab", { name: "Live", exact: true }).click();
    await shot("live-tab");
    const start = page.getByRole("button", { name: "Start live walkthrough" });
    await expect(start).toBeVisible({ timeout: 30000 });
    await start.click();

    // Plan 1: picker appears instead of recording starting.
    const picker = page.locator("[data-walkthrough-job-picker]");
    await expect(picker).toBeVisible();
    await expect(picker.getByText("Which job is this?")).toBeVisible();
    await expect(picker.getByRole("button", { name: /Record without a job/ })).toBeVisible();
    await expect(picker.getByRole("button", { name: "Cancel" })).toBeVisible();
    await shot("picker");

    // Plan 2: search for junk shows empty state.
    const search = picker.getByLabel("Search jobs");
    await search.fill("zzzzqqqq-no-such-job");
    await expect(picker.getByText("No jobs match that search.")).toBeVisible();
    await shot("search-no-match");

    // Plan 3: cancel closes picker and returns to the idle Walkthrough button.
    await picker.getByRole("button", { name: "Cancel" }).click();
    await expect(picker).toBeHidden();
    await expect(start).toBeVisible();

    // Plan 4: pick a job -> Initial/Final stage hub opens (no recording started).
    await start.click();
    await expect(picker).toBeVisible();
    await search.fill("a");
    const jobButtons = picker.locator("div[role=group] button");
    await expect(jobButtons.first()).toBeVisible({ timeout: 15000 });
    await shot("search-results");
    await jobButtons.first().click();
    await expect(picker).toBeHidden();
    await expect(page.getByRole("button", { name: /Start Initial inspection/ })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /Start Final Inspection/ })).toBeVisible();
    await expect(page.getByText("Checking job status").first()).toBeHidden({ timeout: 20000 });
    await shot("stage-hub");

    expect(newConsoleErrors(BASELINE), "new browser console errors").toEqual([]);
  });
});
