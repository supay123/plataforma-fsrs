import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/** Elige en un `Select` (su botón `combobox`) la opción con ese `value`, como lo haría una persona. */
export async function chooseSelectValue(user: UserEvent, combobox: HTMLElement, value: string) {
  await user.click(combobox);
  const option = within(await screen.findByRole("listbox")).getAllByRole("option").find((candidate) => candidate.dataset.value === value);
  if (!option) throw new Error(`El Select no tiene una opción con value "${value}".`);
  await user.click(option);
}
