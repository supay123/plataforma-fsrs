import clsx from "clsx";
import { ArrowRight, BookOpen, ChevronDown, ClipboardCheck, Crosshair, Gauge, LogIn, Pause, Play, RotateCcw, RotateCw, Target, Volume2, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { Logo } from "../components/layout/Logo";
import { PublicFooter } from "../components/layout/PublicLayout";
import { BUSINESS, PLAN, formatSoles } from "../config/business";
import { useAuth } from "../features/auth/AuthProvider";
import { PlanCards } from "../features/payments/PlanCards";
// El video intenta empezar con sonido; si el navegador lo bloquea, sigue en
// silencio y "Toca para escuchar" lo reinicia desde 0 con sonido.
const VIDEO_URL = "/video/videoplayback.webm";
const POSTER_URL = "/image/poster.webp";

// Tope redondeado hacia arriba a 10 céntimos, siempre mayor al precio diario real.
const dailyCap = Math.floor((PLAN.priceSoles / 30) * 10 + 1) / 10;

const benefits: Array<{ icon: LucideIcon; text: string }> = [
  { icon: Gauge, text: "Mide tu acierto real, tema por tema" },
  { icon: Zap, text: "Detecta y corrige tus errores al instante" },
  { icon: Crosshair, text: "Entrena solo lo que te falta para ingresar" },
];

const steps: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: BookOpen, title: "Estudia tu tema", text: "Con tus apuntes o libros." },
  { icon: ClipboardCheck, title: "Sesión de estudio", text: "Selecciona tu tema, resuelve 20 preguntas y mira al instante en qué fallaste." },
  { icon: Target, title: "Corrige y domina", text: `${BUSINESS.brand} te vuelve a poner tus errores hasta que domines el 100% del tema.` },
];

// Borra las preguntas que no quieras mostrar; el orden del array es el de la página.
const faqs = [
  { question: `¿${BUSINESS.brand} reemplaza a mi academia?`, answer: "No. La teoría la aprendes en tu academia o en tus libros. Aquí compruebas con preguntas si de verdad la dominas y entrenas justo en lo que te falta." },
  { question: "¿Cuánto tiempo al día necesito?", answer: "Con unos 15 minutos al día es suficiente: es lo que toma una sesión de estudio de 20 preguntas. La haces cuando quieras; lo importante es practicar seguido para que tus repasos lleguen a tiempo." },
  { question: "¿Funciona en el celular? ¿Tengo que instalar algo?", answer: `No necesitas instalar nada. ${BUSINESS.brand} funciona desde el navegador de tu celular, tablet o computadora. Solo necesitas conexión a internet.` },
  { question: "¿Qué es el repaso espaciado?", answer: `Es un método que te vuelve a mostrar cada pregunta justo cuando estás por olvidarla. ${BUSINESS.brand} usa un algoritmo de repetición espaciada para programar tus repasos y te insiste más en las preguntas que fallas, hasta que domines el tema.` },
  { question: "¿Se renueva automáticamente?", answer: "No. No hay débitos ni renovaciones automáticas, así que no necesitas cancelar nada: solo pagas cuando decides seguir." },
  { question: "Soy menor de edad, ¿puedo registrarme?", answer: "Sí, pero la cuenta debe crearla y el plan pagarlo tu padre, madre o apoderado." },
  { question: "¿Cómo los contacto si tengo otra duda?", answer: "Escríbenos por WhatsApp, llámanos o envíanos un correo. Encontrarás todos los datos de contacto al final de esta página." },
];

/** Pregunta desplegable: se abre con una animación corta y la flecha gira. */
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className={clsx("rounded-2xl border bg-slate-50 shadow-sm transition", open ? "border-emerald-300 shadow-md" : "border-slate-200")}>
    <h3>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}
        className={clsx("flex w-full items-center justify-between gap-4 p-5 text-left font-semibold transition", open && "text-emerald-700")}>
        {question}
        <ChevronDown size={20} aria-hidden className={clsx("shrink-0 text-emerald-600 transition-transform duration-300", open && "rotate-180")} />
      </button>
    </h3>
    {/* La fila pasa de 0fr a 1fr para animar la altura sin medirla. */}
    <div id={id} role="region" className={clsx("grid transition-all duration-300 ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
      <div className="overflow-hidden" inert={!open}><p className="px-5 pb-5 text-sm leading-6 text-slate-600">{answer}</p></div>
    </div>
  </div>;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

/** Luz difusa de fondo que se mueve lentamente. */
function Glow({ className }: { className: string }) {
  return <div aria-hidden className={clsx("pointer-events-none absolute rounded-full blur-3xl motion-safe:animate-glow", className)} />;
}

/** Aparece con un leve desplazamiento hacia arriba la primera vez que entra en pantalla. */
function Reveal({ children, delay = 0, className, as: Tag = "div" }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "li" }) {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const element = ref.current;
    if (visible || !element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.15 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);
  return <Tag ref={ref} style={{ transitionDelay: `${delay}ms` }} className={clsx(
    "transition duration-700 ease-out motion-reduce:transition-none",
    visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100",
    className,
  )}>{children}</Tag>;
}

/** Indica si la página ya se desplazó desde el inicio. */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return scrolled;
}

function Header() {
  // En el inicio el header se funde con el hero (sin línea, fondo ni logo, que ya está grande en el centro);
  // al desplazarse aparecen el fondo desenfocado, la línea inferior y el logo.
  // En celular no hay logo: los dos botones usan todo el ancho.
  const scrolled = useScrolled();
  return <header className={clsx("sticky top-0 z-20 border-b transition-colors duration-300",
    scrolled ? "border-slate-800/80 bg-slate-950/80 backdrop-blur" : "border-transparent bg-transparent")}>
    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
      <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Ir al inicio" tabIndex={scrolled ? 0 : -1}
        className={clsx("hidden transition-opacity duration-300 sm:block", scrolled ? "opacity-100" : "pointer-events-none opacity-0")}><Logo className="h-6 sm:h-7" /></button>
      <nav aria-label="Secciones" className="flex w-full items-center justify-end gap-2 whitespace-nowrap sm:w-auto">
        <Link to="/estudiante/login" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 px-4 text-sm font-semibold transition hover:border-emerald-400 hover:bg-slate-900">
          <LogIn size={16} aria-hidden className="hidden sm:block" />Iniciar sesión
        </Link>
        <StartButton compact />
      </nav>
    </div>
  </header>;
}

function IntroVideo({ onEnded }: { onEnded: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    // Primero intenta con sonido; si el navegador lo bloquea, sigue en silencio.
    element.muted = false;
    element.play()?.catch(() => {
      element.muted = true;
      void element.play()?.catch(() => undefined);
    });
  }, []);

  // Al activar el sonido vuelve a empezar para no perderse el inicio.
  const unmute = () => {
    const element = video.current;
    if (!element) return;
    element.currentTime = 0;
    element.muted = false;
    void element.play()?.catch(() => undefined);
  };

  // Repite a mano en vez de usar `loop`, que no dispara `ended`.
  const restart = () => {
    const element = video.current;
    if (!element) return;
    onEnded();
    element.currentTime = 0;
    void element.play()?.catch(() => undefined);
  };

  // Controles: con mouse se muestran al pasar por encima; en celular, al tocar el video.
  // Mientras el video está pausado siguen visibles; si está reproduciéndose se ocultan al salir
  // el mouse o, en celular, a los 2 s.
  const [controlsVisible, setControlsVisible] = useState(false);
  const hovering = useRef(false);
  const hideTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  const showControls = () => {
    window.clearTimeout(hideTimer.current);
    setControlsVisible(true);
  };

  const hideControlsLater = (delay = 2000) => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!video.current?.paused) setControlsVisible(false);
    }, delay);
  };

  // Tras tocar un control en celular, vuelve a contar los 2 s.
  const afterControl = () => { if (!hovering.current) hideControlsLater(); };

  const togglePlay = () => {
    const element = video.current;
    if (!element) return;
    if (element.paused) void element.play()?.catch(() => undefined);
    else element.pause();
    showControls();
    afterControl();
  };

  const seek = (seconds: number) => {
    const element = video.current;
    if (!element) return;
    element.currentTime = Math.max(0, Math.min(element.currentTime + seconds, element.duration || 0));
    showControls();
    afterControl();
  };

  const controlClass = "relative grid place-items-center rounded-full bg-slate-950/75 text-white shadow-lg transition hover:bg-emerald-600";

  return <div className="relative">
    <div aria-hidden className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-emerald-600/25 via-transparent to-slate-600/25 blur-2xl" />
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900 shadow-2xl shadow-black/60"
      onPointerEnter={(event) => { if (event.pointerType === "mouse") { hovering.current = true; showControls(); } }}
      onPointerLeave={(event) => { if (event.pointerType === "mouse") { hovering.current = false; hideControlsLater(0); } }}>
      <video ref={video} className="absolute inset-0 h-full w-full object-cover" src={VIDEO_URL} poster={POSTER_URL} aria-label={`Conoce ${BUSINESS.brand}`}
        playsInline preload="auto" onEnded={restart} onPlay={() => setPaused(false)} onPause={() => { setPaused(true); showControls(); }}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)} />
      {!muted && <>
        {/* Tocar el video pausa o reanuda y muestra los controles. */}
        <button type="button" tabIndex={-1} aria-hidden onClick={togglePlay} className="absolute inset-0 cursor-pointer" />
        <div className={clsx("pointer-events-none absolute inset-0 flex items-center justify-center gap-4 transition-opacity duration-600 focus-within:opacity-100 sm:gap-6",
          controlsVisible ? "opacity-100" : "opacity-0")}>
          <button type="button" onClick={() => seek(-5)} onFocus={showControls} onBlur={afterControl} aria-label="Retroceder 5 segundos"
            className={clsx(controlClass, "h-12 w-12", controlsVisible && "pointer-events-auto")}>
            <RotateCcw size={34} strokeWidth={1.75} aria-hidden /><span aria-hidden className="absolute text-[10px] font-bold">5s</span>
          </button>
          <button type="button" onClick={togglePlay} onFocus={showControls} onBlur={afterControl} aria-label={paused ? "Reproducir" : "Pausar"}
            className={clsx(controlClass, "h-16 w-16", controlsVisible && "pointer-events-auto")}>
            {paused ? <Play size={28} aria-hidden className="ml-1" /> : <Pause size={28} aria-hidden />}
          </button>
          <button type="button" onClick={() => seek(5)} onFocus={showControls} onBlur={afterControl} aria-label="Adelantar 5 segundos"
            className={clsx(controlClass, "h-12 w-12", controlsVisible && "pointer-events-auto")}>
            <RotateCw size={34} strokeWidth={1.75} aria-hidden /><span aria-hidden className="absolute text-[10px] font-bold">5s</span>
          </button>
        </div>
      </>}
      {muted && <button type="button" onClick={unmute} className="group absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/45 text-white transition hover:bg-slate-950/30">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-600 shadow-xl shadow-emerald-950/60 transition group-hover:scale-110 motion-safe:animate-pulse sm:h-20 sm:w-20">
          <Volume2 aria-hidden className="h-8 w-8 sm:h-10 sm:w-10" />
        </span>
        <span className="text-2xl font-extrabold drop-shadow-lg sm:text-3xl">Toca para escuchar</span>
      </button>}
    </div>
  </div>;
}

/** Llamada principal: lleva a la sección de planes. */
function StartButton({ compact = false }: { compact?: boolean }) {
  // Verde sólido con texto oscuro para diferenciarlo del resto de botones.
  return <button type="button" onClick={() => scrollToSection("planes")} className={clsx(
    "group inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 font-semibold text-slate-950 transition duration-300 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300",
    compact ? "min-h-10 px-4 text-sm sm:px-5" : "min-h-14 px-8 text-lg",
  )}>
    Empieza ahora
    <ArrowRight size={16} aria-hidden className={clsx("transition group-hover:translate-x-0.5", compact && "hidden sm:block")} />
  </button>;
}

export function HomePage() {
  const { profile, loading } = useAuth();
  // Se activa cada vez que termina el video para animar el botón principal.
  const [popStart, setPopStart] = useState(false);
  if (!loading && profile) return <Navigate to={profile.role === "teacher" ? "/profesor" : `/${profile.role === "student" ? "estudiante" : "admin"}`} replace />;
  // Cada sección ocupa una pantalla debajo del header fijo (4rem).
  return <div className="overflow-x-clip bg-slate-950 text-white">
    <Header />

    {/* Encima del pie fijo (z-0), que queda descubierto al terminar la página. */}
    <main className="relative z-10 bg-slate-950 shadow-xl shadow-black/40">
    <section className="relative flex min-h-[calc(100svh-4rem)] flex-col items-center px-4 pb-4 sm:pb-10">
      <div aria-hidden className="bg-grid absolute inset-0" />
      <Glow className="-left-32 top-10 h-96 w-96 bg-emerald-600/15" />
      <Glow className="-right-24 bottom-0 h-80 w-80 bg-emerald-500/10 [animation-delay:-4s]" />
      <Reveal className="relative flex flex-col items-center text-center sm:pt-8">
        <Logo className="h-8 sm:h-20" />
        {/* En celular el título es más pequeño y no fuerza el salto de línea. */}
        <h1 className="mt-3 max-w-7xl font-display text-2xl font-semibold tracking-wide sm:mt-4 sm:text-5xl">
          No estudies TODO. <span className="bg-gradient-to-r from-emerald-200 to-emerald-400 bg-clip-text text-transparent">Estudia lo que no sabes</span>
          <br className="hidden sm:inline" /> e INGRESA a la UNSAAC
        </h1>
      </Reveal>
      <div className="relative mx-auto grid w-full max-w-6xl flex-1 content-evenly items-center gap-4 px-0 pt-10 sm:gap-10 sm:px-8 sm:pt-8 lg:grid-cols-2 lg:gap-14">
        {/* En celular el video se achica para que toda la sección entre en pantalla. */}
        <Reveal className="mx-auto w-full max-w-[340px] sm:max-w-none"><IntroVideo onEnded={() => setPopStart(true)} /></Reveal>
        {/* Mismo ancho para el texto y la lista, así quedan alineados en celular. */}
        <Reveal delay={150} className="mx-auto max-w-md text-center lg:mx-0 lg:text-left">
          <p className="text-base text-slate-300 sm:text-lg">Deja de estudiar sin rumbo. {BUSINESS.brand} te muestra en qué fallas y te entrena justo en lo que te falta para ingresar.</p>
          {/* En celulares bajos se oculta la lista para que el resto entre sin scroll. */}
          <ul className="mt-4 grid gap-2 text-left [@media(max-width:639px)_and_(max-height:700px)]:hidden sm:mt-6 sm:gap-3">
            {benefits.map(({ icon: Icon, text }) => <li key={text} className="flex items-center gap-2.5 text-sm text-slate-200 sm:gap-3 sm:text-base">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300 sm:h-8 sm:w-8"><Icon size={16} aria-hidden /></span>{text}
            </li>)}
          </ul>
          <p className="mt-4 text-sm text-slate-400 sm:mt-7">
            Empieza con <strong className="text-base font-bold text-emerald-300">{formatSoles(PLAN.priceSoles)} al mes</strong> · menos de {formatSoles(dailyCap)} al día
          </p>
          <div className={clsx("mt-4 flex justify-center sm:mt-3", popStart && "motion-safe:animate-pop")} onAnimationEnd={() => setPopStart(false)}>
            <StartButton compact />
          </div>
        </Reveal>
      </div>
    </section>

    {/* Las secciones alternan fondo oscuro, blanco, oscuro y claro para que se distinga dónde empieza cada una. */}
    <section id="pasos" className="relative flex min-h-[calc(100svh-4rem)] scroll-mt-16 flex-col justify-center overflow-hidden bg-slate-50 px-4 py-16 text-center text-slate-900">
      <Glow className="left-1/2 top-1/3 h-64 w-[36rem] -translate-x-1/2 bg-emerald-100/70" />
      <div className="relative mx-auto max-w-5xl">
        <Reveal>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">Cómo funciona</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-wide sm:text-4xl">3 pasos para ingresar con {BUSINESS.brand.toUpperCase()}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">{BUSINESS.brand} no reemplaza a tu academia: la teoría la aprendes allí o en tus libros, y aquí compruebas con preguntas si de verdad la dominas.</p>
        </Reveal>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, index) => <Reveal as="li" key={title} delay={index * 120}>
            <div className="group flex h-full flex-col items-center rounded-xl border border-emerald-100 bg-emerald-50/60 p-8 transition duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-xl hover:shadow-emerald-200/60">
              <span className="grid h-16 w-16 place-items-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-300/60 transition group-hover:bg-emerald-700"><Icon size={32} aria-hidden /></span>
              <span className="mt-5 text-sm font-bold text-emerald-700">Paso {index + 1}</span>
              <h3 className="mt-1 text-xl font-bold uppercase">{title}</h3>
              <p className="mt-3 text-slate-600">{text}</p>
            </div>
          </Reveal>)}
        </ol>
      </div>
      <div className={clsx("mt-8 flex justify-center", popStart && "motion-safe:animate-pop")} onAnimationEnd={() => setPopStart(false)}>
        <StartButton compact />
      </div>
    </section>

    <section id="planes" className="relative flex min-h-[calc(100svh-4rem)] scroll-mt-16 flex-col justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-16 text-center">
      <div aria-hidden className="bg-grid absolute inset-0" />
      <Glow className="-right-40 top-1/4 h-96 w-96 bg-emerald-500/10" />
      <Glow className="-left-40 bottom-10 h-96 w-96 bg-slate-400/10 [animation-delay:-3s]" />
      <Reveal className="relative">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">Planes</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-wide sm:text-4xl">Elige tu plan</h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-300">Menos de {formatSoles(dailyCap)} al día. Sin renovación automática: vuelves a pagar solo si decides seguir.</p>
      </Reveal>
      <Reveal delay={150} className="relative"><PlanCards className="mt-10 w-full" /></Reveal>
    </section>

    <section id="preguntas" className="scroll-mt-16 bg-slate-100 px-4 py-20 text-slate-900">
      <Reveal className="mx-auto max-w-3xl">
        <p className="text-center text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">Dudas</p>
        <h2 className="mt-3 text-center font-display text-3xl font-semibold tracking-wide">Preguntas frecuentes</h2>
        <div className="mt-8 grid gap-3">{faqs.map((faq) => <FaqItem key={faq.question} {...faq} />)}</div>
      </Reveal>
    </section>
    </main>

    <PublicFooter />
  </div>;
}
export function NotFoundPage() { return <main className="grid min-h-screen place-items-center p-6 text-center"><div><strong className="text-6xl text-emerald-700">404</strong><h1 className="mt-4 text-2xl font-bold">Página no encontrada</h1><Link className="mt-5 inline-block font-semibold text-emerald-700" to="/">Volver al inicio</Link></div></main>; }
