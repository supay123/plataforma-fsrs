import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { APP_VERSION } from "../../config/version";
import { VersionPage } from "./VersionPage";

describe("VersionPage", () => {
  it("muestra la versión de la aplicación", () => {
    render(<MemoryRouter><VersionPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: `Versión ${APP_VERSION}` })).toBeInTheDocument();
  });
});
