import { test, expect } from "../fixtures.mjs";

// This app's console baseline from step 0d (stable substring).
const BASELINE = ["WebSocket connection to 'wss://jbarlcajqpbzbhvbxaci.supabase.co/realtime/v1/websocket"];

async function openScheduler(page) {
  await page.goto("/schedule?workspace=calendar&view=calendar");
  await page.waitForLoadState("networkidle");
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  const newWork = page.getByRole("button", { name: /New work/ }).first();
  if (!(await newWork.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Scheduler", exact: true }).first().click();
  }
  await expect(page.getByRole("button", { name: /New work/ }).first()).toBeVisible();
}

async function draftChanges(page) {
  const text = await page.locator("body").innerText();
  const m = text.match(/(\d+)\s*\n\s*Draft changes/);
  return m ? Number(m[1]) : null;
}

test.describe("BSR-1307 Scheduler: crew needed, linked dev projects, unpublished delete", () => {
  test("Crew needed stays 1-20 and a linked dev project clears the link warning", async ({ page, shot, newConsoleErrors }) => {
    await openScheduler(page);
    await page.getByRole("button", { name: /New work/ }).first().click();
    const editor = page.getByRole("dialog");
    await expect(editor.getByText("New schedule item")).toBeVisible();
    await shot("editor-open");

    // B05: unlinked work warns, linking a dev (non-v4 id) project clears the warning and sends to the schedule.
    await expect(editor.getByText(/must be linked to an existing project before publishing/)).toBeVisible();
    await editor.getByPlaceholder("Search project, client, type, address, or phase").fill("Unit 3B");
    await editor.getByRole("option", { name: /Unit 3B kitchen leak/ }).click();
    await expect(editor.getByText(/must be linked to an existing project before publishing/)).toBeHidden();
    await expect(editor.getByRole("button", { name: /Save to schedule/ })).toBeVisible();
    await shot("linked-project");

    // B04: Crew needed can't be 0 or above 20.
    const crew = editor.getByLabel("Crew needed");
    await crew.fill("0");
    await crew.press("Tab");
    await expect(crew).toHaveValue("1");
    await crew.fill("99");
    await crew.press("Tab");
    await expect(crew).toHaveValue("20");
    await crew.fill("3");
    await crew.press("Tab");
    await expect(crew).toHaveValue("3");
    await shot("crew-needed-clamped");

    // Nothing is saved: a linked save would notify the crew.
    await editor.getByRole("button", { name: "Cancel" }).click();
    await expect(editor).toBeHidden();
    expect(newConsoleErrors(BASELINE), "new browser console errors").toEqual([]);
  });

  test("Deleting a never-published scheduled draft leaves no pending change", async ({ page, shot, newConsoleErrors }) => {
    const name = `QA BSR-1307 ${Date.now()}`;
    await openScheduler(page);
    const before = await draftChanges(page);
    expect(before, "draft change counter visible").not.toBeNull();

    // Create an unlinked scheduled draft (no crew is notified by a draft).
    await page.getByRole("button", { name: /New work/ }).first().click();
    const editor = page.getByRole("dialog");
    await editor.getByText("New schedule item").click();
    await editor.getByLabel("Project or job name").fill(name);
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect(editor).toBeHidden({ timeout: 20000 });
    await expect.poll(() => draftChanges(page), { timeout: 15000 }).toBe(before + 1);
    await shot("draft-created");

    // Survives a refresh (give the draft autosave time to land first).
    await page.waitForTimeout(5000);
    await page.reload();
    await page.waitForLoadState("networkidle");
    const card = () => page.locator(`span[title="${name}"]:visible`).first();
    await expect(card()).toBeVisible({ timeout: 20000 });
    expect(await draftChanges(page)).toBe(before + 1);

    // Delete it.
    await card().click();
    await page.getByRole("button", { name: "Edit schedule" }).click();
    await shot("editor-before-delete");
    await page.getByRole("button", { name: "Delete work" }).click();
    await expect(page.locator(`span[title="${name}"]:visible`)).toHaveCount(0, { timeout: 15000 });
    await shot("after-delete");

    // After a refresh it stays gone, with no pending "deleted:" change.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator(`span[title="${name}"]:visible`)).toHaveCount(0);
    expect(await draftChanges(page)).toBe(before);
    await expect(page.getByText(`deleted: ${name}`)).toHaveCount(0);
    await shot("after-refresh");
    expect(newConsoleErrors(BASELINE), "new browser console errors").toEqual([]);
  });
});
