import { Check, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { Children, Fragment, isValidElement, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode, Ref, SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { controlClass, type ControlProps } from "./control-styles";
import { ControlIcon } from "./controls";
import { FieldLabelContext } from "./field-label-context";

interface SelectOption { value: string; label: string; disabled: boolean }

const PHONE_QUERY = "(max-width: 639px)";
const MAX_LIST_HEIGHT = 288;

function textOf(node: ReactNode): string {
  return Children.toArray(node).map((child) => {
    if (typeof child === "string" || typeof child === "number") return String(child);
    return isValidElement<{ children?: ReactNode }>(child) ? textOf(child.props.children) : "";
  }).join("");
}

/** Lee los `<option>` hijos igual que un `<select>` nativo, para que el uso no cambie. */
function readOptions(children: ReactNode): SelectOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; disabled?: boolean }>(child)) return [];
    if (child.type === Fragment) return readOptions(child.props.children);
    if (child.type !== "option") return [];
    const label = textOf(child.props.children);
    return [{ value: String(child.props.value ?? label), label, disabled: Boolean(child.props.disabled) }];
  });
}

function useIsPhone() {
  const [isPhone, setIsPhone] = useState(() => typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(PHONE_QUERY);
    const update = () => setIsPhone(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isPhone;
}

const watchedSelects = new WeakSet<HTMLSelectElement>();
/** React Hook Form (reset, setValue) asigna `ref.value` sin disparar eventos; así la interfaz se entera. */
function watchValueAssignments(select: HTMLSelectElement, onAssign: () => void) {
  if (watchedSelects.has(select)) return;
  watchedSelects.add(select);
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  if (!nativeValue?.get || !nativeValue.set) return;
  Object.defineProperty(select, "value", {
    configurable: true,
    get() { return nativeValue.get!.call(this); },
    set(next: string) { nativeValue.set!.call(this, next); onAssign(); },
  });
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & ControlProps & { ref?: Ref<HTMLSelectElement> };

/**
 * Selector con desplegable propio, intercambiable por un `<select>` nativo (mismos `<option>`, `value`, `onChange`,
 * `register`). Un `<select>` oculto conserva el valor real, la validación del formulario y los eventos.
 * El desplegable mide lo mismo que el campo y recorta con «…» los textos largos; cada opción lleva su tooltip.
 * En móvil las opciones largas se parten en varias líneas. Mientras está abierto, una capa transparente evita interactuar con el resto de la página.
 */
export function Select({ variant, icon, className, children, ref, id, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, "aria-describedby": ariaDescribedBy, ...selectProps }: SelectProps) {
  const options = readOptions(children);
  const nativeRef = useRef<HTMLSelectElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pressedOnTrigger = useRef(false);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<CSSProperties>({});
  const [triggerBox, setTriggerBox] = useState<CSSProperties>({});
  const isPhone = useIsPhone();
  const listId = useId();
  const fieldLabelId = useContext(FieldLabelContext);
  const disabled = Boolean(selectProps.disabled);

  const syncValue = useCallback(() => setValue(nativeRef.current?.value ?? ""), []);
  // El `<select>` oculto es la fuente de verdad: refleja `value` controlado, opciones que llegan tarde y asignaciones externas.
  useLayoutEffect(syncValue);

  const attachNative = useCallback((element: HTMLSelectElement | null) => {
    nativeRef.current = element;
    if (element) watchValueAssignments(element, syncValue);
    if (typeof ref === "function") ref(element);
    else if (ref) ref.current = element;
  }, [ref, syncValue]);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = options[selectedIndex];
  const showsPlaceholder = !selectedOption || selectedOption.value === "";

  const measure = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTriggerBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const opensUpwards = spaceBelow < 200 && spaceAbove > spaceBelow;
    setPosition({
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(MAX_LIST_HEIGHT, (opensUpwards ? spaceAbove : spaceBelow) - 4),
      ...(opensUpwards ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  }, []);

  const openList = () => {
    if (disabled) return;
    measure();
    setActiveIndex(Math.max(0, selectedIndex));
    setOpen(true);
  };
  const closeList = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const choose = (option: SelectOption | undefined) => {
    const native = nativeRef.current;
    if (!native || !option || option.disabled) return;
    if (native.value !== option.value) {
      native.value = option.value;
      native.dispatchEvent(new Event("change", { bubbles: true }));
    }
    closeList();
  };

  useEffect(() => {
    if (!open) return;
    const remeasure = (event: Event) => { if (!listRef.current?.contains(event.target as Node)) measure(); };
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);
    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex]);

  const moveActive = (step: 1 | -1, from = activeIndex) => {
    for (let index = from + step; index >= 0 && index < options.length; index += step) {
      if (!options[index]!.disabled) { setActiveIndex(index); return; }
    }
  };
  const jumpActive = (edge: "first" | "last") => {
    const indexes = options.map((option, index) => (option.disabled ? -1 : index)).filter((index) => index >= 0);
    const target = edge === "first" ? indexes[0] : indexes[indexes.length - 1];
    if (target !== undefined) setActiveIndex(target);
  };
  const jumpToLetter = (letter: string) => {
    const lowered = letter.toLowerCase();
    const ordered = [...options.keys()].map((_, offset) => (activeIndex + 1 + offset) % options.length);
    const match = ordered.find((index) => !options[index]!.disabled && options[index]!.label.toLowerCase().startsWith(lowered));
    if (match !== undefined) setActiveIndex(match);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const { key } = event;
    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") { event.preventDefault(); openList(); }
      return;
    }
    if (key === "ArrowDown") { event.preventDefault(); moveActive(1); }
    else if (key === "ArrowUp") { event.preventDefault(); moveActive(-1); }
    else if (key === "Home") { event.preventDefault(); jumpActive("first"); }
    else if (key === "End") { event.preventDefault(); jumpActive("last"); }
    else if (key === "Enter" || key === " ") { event.preventDefault(); choose(options[activeIndex]); }
    else if (key === "Escape") { event.preventDefault(); event.stopPropagation(); closeList(); }
    else if (key === "Tab") setOpen(false);
    else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) jumpToLetter(key);
  };

  const handleBlur = () => {
    setOpen(false);
    nativeRef.current?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  };

  const tooltip = selectedOption?.label || undefined;
  const optionsList = open && createPortal(
    <>
      {/* Capa transparente: mientras la lista está abierta, pulsar fuera solo la cierra y no toca nada de la página. */}
      <div aria-hidden="true" className="fixed inset-0 z-[60]" onClick={() => closeList(false)} />
      {/* Sobre el propio campo la capa sí muestra la manito, porque pulsarlo lo cierra. */}
      <div aria-hidden="true" className="fixed z-[65] cursor-pointer" style={triggerBox} onClick={() => closeList()} />
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-labelledby={ariaLabelledBy ?? fieldLabelId}
        aria-label={ariaLabel}
        style={position}
        // Evita que pulsar una opción le quite el foco al botón.
        onMouseDown={(event) => event.preventDefault()}
        className={clsx(
          "select-scroll fixed z-[70] divide-y divide-slate-200 overflow-y-auto rounded-xl border border-slate-300 bg-white py-1 text-slate-800 shadow-lg dark:border-white/15 dark:bg-slate-900 dark:text-slate-200 portal:border-2 portal:border-line-strong portal:bg-blocks portal:text-on-blocks portal:shadow-[0_4px_0_var(--c-line)] dark:divide-white/10 portal:divide-line",
        )}
      >
        {options.map((option, index) => {
          const selected = index === selectedIndex;
          return (
            <div
              key={`${option.value}-${index}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={selected}
              aria-disabled={option.disabled || undefined}
              data-index={index}
              data-value={option.value}
              title={option.label || undefined}
              onMouseEnter={() => { if (!option.disabled) setActiveIndex(index); }}
              onClick={() => choose(option)}
              className={clsx(
                "flex min-h-10 cursor-pointer items-center gap-2 px-3 py-2 text-sm",
                index === activeIndex && "bg-indigo-50 dark:bg-white/10 portal:bg-sunken",
                selected && "font-semibold text-indigo-700 dark:text-emerald-400 portal:text-primary-text",
                option.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span className={clsx("min-w-0 flex-1", isPhone ? "break-words" : "truncate")}>{option.label}</span>
              {selected && <Check aria-hidden="true" size={16} className="shrink-0" />}
            </div>
          );
        })}
      </div>
    </>,
    document.body,
  );

  return (
    <span className="relative block">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : (ariaLabelledBy ?? fieldLabelId)}
        aria-describedby={ariaDescribedBy}
        aria-required={selectProps.required || undefined}
        disabled={disabled}
        title={tooltip}
        onPointerDown={() => { pressedOnTrigger.current = true; }}
        onClick={() => {
          // Pulsar la etiqueta del Field hace que el navegador "haga clic" en el botón; ese clic no trae pulsación propia y se ignora.
          if (!pressedOnTrigger.current) return;
          pressedOnTrigger.current = false;
          if (open) closeList(); else openList();
        }}
        onKeyDown={handleKeyDown}
        // Con Espacio el navegador hace clic al soltar la tecla: se anula para no reabrir la lista recién cerrada.
        onKeyUp={(event) => { if (event.key === " ") event.preventDefault(); }}
        onBlur={handleBlur}
        className={controlClass({ variant, icon }, "flex cursor-pointer items-center pr-10 text-left disabled:cursor-not-allowed disabled:opacity-50", className)}
      >
        <span className={clsx("block min-w-0 flex-1 truncate", showsPlaceholder && "text-slate-500 dark:text-slate-400 portal:text-fg-faint")}>{selectedOption?.label || " "}</span>
      </button>
      {/* Va después del botón para que pulsar la etiqueta del `Field` active el botón y no abra el selector nativo; si algo lo enfoca, el foco pasa al botón. */}
      <select
        {...selectProps}
        ref={attachNative}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        onFocus={(event) => { triggerRef.current?.focus(); selectProps.onFocus?.(event); }}
      >
        {children}
      </select>
      {icon && <ControlIcon icon={icon} />}
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-500 peer-focus:text-indigo-600 dark:peer-focus:text-emerald-400 portal:text-fg-muted portal:peer-focus:text-primary-text">
        <ChevronDown size={18} className={clsx("transition-transform duration-150", open && "rotate-180")} />
      </span>
      {optionsList}
    </span>
  );
}
