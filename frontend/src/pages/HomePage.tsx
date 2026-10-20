import clsx from "clsx";
import { BookOpen, ClipboardCheck, Crosshair, Gauge, LogIn, Target, Volume2, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { Logo } from "../components/layout/Logo";
import { PublicFooter } from "../components/layout/PublicLayout";
import { BUSINESS, PLAN, formatSoles } from "../config/business";
import { useAuth } from "../features/auth/AuthProvider";
import { PlanCards } from "../features/payments/PlanCards";
import { loadYouTubeApi, type YouTubePlayer } from "../lib/youtube";

const VIDEO_ID = "nE8ms_B1G7M";
// El video intenta empezar con sonido; si el navegador lo bloquea, sigue en
// silencio y el botón "Activar sonido" lo habilita. Esta URL solo se usa si
// la API de YouTube no carga.
const MUTED_VIDEO_URL = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${VIDEO_ID}&playsinline=1&rel=0`;

const signUpPath = `/estudiante/sign-up?plan=${PLAN.id}`;
// Tope redondeado hacia arriba a 10 céntimos, siempre mayor al precio diario real.
const dailyCap = Math.floor((PLAN.priceSoles / 30) * 10 + 1) / 10;

const sections = [
  { id: "pasos", label: "Cómo funciona" },
  { id: "planes", label: "Planes" },
];

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

function Header() {
  return <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
      <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Ir al inicio"><Logo className="h-6 sm:h-7" /></button>
      <nav aria-label="Secciones" className="flex items-center gap-1 sm:gap-2">
        {sections.map((section) => <button key={section.id} type="button" onClick={() => scrollToSection(section.id)} className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white sm:inline-flex">{section.label}</button>)}
        <Link to="/estudiante/login" className="ml-1 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 px-4 text-sm font-semibold transition hover:border-indigo-400 hover:bg-slate-900">
          <LogIn size={16} aria-hidden />Iniciar sesión
        </Link>
      </nav>
    </div>
  </header>;
}

function IntroVideo() {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const [muted, setMuted] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let fallback: number | undefined;
    const playMuted = (target: YouTubePlayer) => { target.mute(); target.playVideo(); setMuted(true); };
    loadYouTubeApi().then((YT) => {
      if (cancelled || !host.current) return;
      // YouTube reemplaza el elemento por su iframe: se le da uno propio para
      // que React no intente quitar un nodo que ya no existe.
      const element = document.createElement("div");
      host.current.append(element);
      player.current = new YT.Player(element, {
        videoId: VIDEO_ID,
        host: "https://www.youtube-nocookie.com",
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, loop: 1, playlist: VIDEO_ID, playsinline: 1, rel: 0 },
        events: {
          // Primero intenta con sonido.
          onReady: ({ target }) => {
            host.current?.querySelector("iframe")?.setAttribute("title", `Conoce ${BUSINESS.brand}`);
            target.unMute();
            target.playVideo();
            // Si en 2 s no arrancó, el navegador lo bloqueó sin avisar.
            fallback = window.setTimeout(() => {
              const state = target.getPlayerState();
              if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING) playMuted(target);
            }, 2000);
          },
          onAutoplayBlocked: ({ target }) => playMuted(target),
          // YouTube también puede silenciarlo por su cuenta para poder reproducirlo.
          onStateChange: ({ target, data }) => { if (data === YT.PlayerState.PLAYING) setMuted(target.isMuted()); },
        },
      });
    }).catch(() => { if (!cancelled) setApiFailed(true); });
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      player.current?.destroy();
      player.current = null;
    };
  }, []);

  const unmute = () => { player.current?.unMute(); player.current?.playVideo(); setMuted(false); };

  return <div className="relative">
    <div aria-hidden className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-indigo-600/40 via-transparent to-emerald-500/30 blur-2xl" />
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900 shadow-2xl shadow-indigo-950/60">
      {apiFailed
        // Sin la API (bloqueada o sin red) queda el video en silencio; se activa con los controles de YouTube.
        ? <iframe className="absolute inset-0 h-full w-full" src={MUTED_VIDEO_URL} title={`Conoce ${BUSINESS.brand}`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        : <div ref={host} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />}
      {muted && <button type="button" onClick={unmute} className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-slate-950/85 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-950">
        <Volume2 size={18} aria-hidden />Activar sonido
      </button>}
    </div>
  </div>;
}

const outlineButton = "inline-flex min-h-14 items-center justify-center rounded-2xl border border-slate-600 bg-slate-950/40 px-6 font-semibold transition hover:border-indigo-400 hover:bg-slate-900";

function SignUpButton() {
  return <Link to={signUpPath} className="relative inline-flex min-h-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-8 text-base font-bold text-white shadow-lg shadow-indigo-700/40 transition hover:-translate-y-0.5 hover:shadow-indigo-600/60">
    {/* Destello que cruza el botón cada pocos segundos. */}
    <span aria-hidden className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/25 to-transparent motion-safe:animate-shine motion-reduce:hidden" />
    <span className="relative">Empieza ahora</span>
  </Link>;
}

export function HomePage() {
  const { profile, loading } = useAuth();
  if (!loading && profile) return <Navigate to={profile.role === "teacher" ? "/profesor" : `/${profile.role === "student" ? "estudiante" : "admin"}`} replace />;
  // Cada sección ocupa una pantalla debajo del header fijo (4rem).
  return <div className="overflow-x-clip bg-slate-950 text-white">
    <Header />

    <section className="relative flex min-h-[calc(100svh-4rem)] items-center px-4 py-10">
      <div aria-hidden className="bg-grid absolute inset-0" />
      <Glow className="-left-32 top-10 h-96 w-96 bg-indigo-600/30" />
      <Glow className="-right-24 bottom-0 h-80 w-80 bg-emerald-500/20 [animation-delay:-4s]" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <Reveal><IntroVideo /></Reveal>
        <Reveal delay={150} className="text-center lg:text-left">
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Estudia lo que <span className="bg-gradient-to-r from-indigo-300 to-emerald-300 bg-clip-text text-transparent">no sabes</span>
          </h1>
          <p className="mt-4 text-lg text-slate-300">Deja de estudiar sin rumbo. {BUSINESS.brand} te muestra en qué fallas y te entrena justo en lo que te falta para ingresar.</p>
          <ul className="mx-auto mt-6 grid max-w-md gap-3 text-left lg:mx-0">
            {benefits.map(({ icon: Icon, text }) => <li key={text} className="flex items-center gap-3 text-slate-200">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300"><Icon size={17} aria-hidden /></span>{text}
            </li>)}
          </ul>
          <p className="mt-6 text-lg">Comienza con <strong className="text-2xl text-emerald-400">{formatSoles(PLAN.priceSoles)}</strong> al mes <span className="text-sm text-slate-400">· menos de {formatSoles(dailyCap)} al día</span></p>
          <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
            <button type="button" onClick={() => scrollToSection("planes")} className={outlineButton}>Ver planes</button>
            <SignUpButton />
            <button type="button" onClick={() => scrollToSection("pasos")} className={outlineButton}>Conoce más</button>
          </div>
        </Reveal>
      </div>
    </section>

    <section id="pasos" className="relative flex min-h-[calc(100svh-4rem)] scroll-mt-16 flex-col justify-center px-4 py-12 text-center">
      <Glow className="left-1/2 top-1/3 h-96 w-[36rem] -translate-x-1/2 bg-indigo-700/20" />
      <div className="relative mx-auto max-w-5xl">
        <Reveal>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Cómo funciona</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">¿3 pasos para ingresar con {BUSINESS.brand.toUpperCase()}?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">{BUSINESS.brand} no reemplaza a tu academia: la teoría la aprendes allí o en tus libros, y aquí compruebas con preguntas si de verdad la dominas.</p>
        </Reveal>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, index) => <Reveal as="li" key={title} delay={index * 120}>
            <div className="group flex h-full flex-col items-center rounded-3xl border border-slate-800 bg-slate-900/80 p-8 transition duration-300 hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-950/60">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-indigo-600/15 text-indigo-300 ring-1 ring-indigo-500/20 transition group-hover:bg-indigo-600/25"><Icon size={32} aria-hidden /></span>
              <span className="mt-5 text-sm font-bold text-emerald-400">Paso {index + 1}</span>
              <h3 className="mt-1 text-xl font-bold uppercase">{title}</h3>
              <p className="mt-3 text-slate-300">{text}</p>
            </div>
          </Reveal>)}
        </ol>
        <Reveal delay={200} className="mt-12"><SignUpButton /></Reveal>
      </div>
    </section>

    <section id="planes" className="relative flex min-h-[calc(100svh-4rem)] scroll-mt-16 flex-col justify-center px-4 py-10 text-center">
      <Glow className="-right-40 top-1/4 h-96 w-96 bg-emerald-500/15" />
      <Glow className="-left-40 bottom-10 h-96 w-96 bg-indigo-600/20 [animation-delay:-3s]" />
      <Reveal className="relative">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Elige tu plan</h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-300">Menos de {formatSoles(dailyCap)} al día. Sin renovación automática: vuelves a pagar solo si decides seguir.</p>
      </Reveal>
      <Reveal delay={150} className="relative"><PlanCards className="mt-8 w-full" /></Reveal>
      <Link to="/precios" className="relative mt-5 text-sm font-semibold text-indigo-300 hover:text-indigo-200">Preguntas frecuentes sobre los planes</Link>
    </section>

    <PublicFooter />
  </div>;
}
export function NotFoundPage() { return <main className="grid min-h-screen place-items-center p-6 text-center"><div><strong className="text-6xl text-indigo-600">404</strong><h1 className="mt-4 text-2xl font-bold">Página no encontrada</h1><Link className="mt-5 inline-block font-semibold text-indigo-600" to="/">Volver al inicio</Link></div></main>; }
