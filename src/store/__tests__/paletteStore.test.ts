import { describe, it, expect, beforeEach } from "vitest";
import { usePaletteStore } from "../paletteStore";

describe("usePaletteStore", () => {
  beforeEach(() => {
    usePaletteStore.setState({ isOpen: false });
  });

  it("initializes with isOpen = false", () => {
    expect(usePaletteStore.getState().isOpen).toBe(false);
  });

  it("opens palette with open() and setOpen(true)", () => {
    usePaletteStore.getState().open();
    expect(usePaletteStore.getState().isOpen).toBe(true);

    usePaletteStore.getState().setOpen(false);
    expect(usePaletteStore.getState().isOpen).toBe(false);

    usePaletteStore.getState().setOpen(true);
    expect(usePaletteStore.getState().isOpen).toBe(true);
  });

  it("closes palette with close()", () => {
    usePaletteStore.getState().open();
    expect(usePaletteStore.getState().isOpen).toBe(true);

    usePaletteStore.getState().close();
    expect(usePaletteStore.getState().isOpen).toBe(false);
  });

  it("toggles palette state with toggle()", () => {
    expect(usePaletteStore.getState().isOpen).toBe(false);
    usePaletteStore.getState().toggle();
    expect(usePaletteStore.getState().isOpen).toBe(true);
    usePaletteStore.getState().toggle();
    expect(usePaletteStore.getState().isOpen).toBe(false);
  });
});

