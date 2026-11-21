import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FreeModeSelector } from "./FreeModeSelector";
import { chooseSelectValue } from "../../components/ui/select-test-helpers";

const mocks = vi.hoisted(() => ({ getFreeModeCatalog: vi.fn() }));
vi.mock("./api", () => mocks);

describe("FreeModeSelector", () => {
  afterEach(cleanup);

  it("unlocks group, course and topic in order and delivers the topic", async () => {
    mocks.getFreeModeCatalog.mockResolvedValue([{ id: "g1", name: "Grupo de prueba", courses: [{ id: "c1", name: "Matemática", topics: [{ id: "t1", name: "Fracciones" }] }] }]);
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FreeModeSelector onStart={onStart} /></QueryClientProvider>);
    const course = await screen.findByRole("combobox", { name: "Curso" });
    const topic = screen.getByRole("combobox", { name: "Tema" });
    expect(course).toBeDisabled();
    expect(topic).toBeDisabled();
    expect(screen.getByRole("button", { name: "Comenzar" })).toBeDisabled();

    await chooseSelectValue(user, screen.getByRole("combobox", { name: "Grupo" }), "g1");
    expect(course).toBeEnabled();
    await chooseSelectValue(user, course, "c1");
    await chooseSelectValue(user, topic, "t1");
    await user.click(screen.getByRole("button", { name: "Comenzar" }));
    expect(onStart).toHaveBeenCalledWith("t1");
  });
});
