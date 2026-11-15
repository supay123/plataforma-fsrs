import clsx from "clsx";
import type { CSSProperties, HTMLAttributes } from "react";

// En los portales todo skeleton lleva bordes redondeados del estilo Chancón (portal:rounded-xl gana a `rounded="none"`).
const radius = {
  none: "rounded-none", sm: "rounded-sm", md: "rounded-md", lg: "rounded-lg",
  xl: "rounded-xl", "2xl": "rounded-2xl", "3xl": "rounded-3xl", full: "rounded-full",
} as const;

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Alto: número en px o cualquier medida CSS (`"2rem"`, `"100%"`). */
  height?: number | string;
  /** Ancho: número en px o cualquier medida CSS. Por defecto ocupa todo el ancho. */
  width?: number | string;
  /** Bordes redondeados. `full` sirve para círculos (avatares). */
  rounded?: keyof typeof radius;
}

/** Marcador de carga con un destello que va de izquierda a derecha. */
export function Skeleton({ height = 16, width = "100%", rounded = "lg", className, style, ...props }: SkeletonProps) {
  const size: CSSProperties = { height, width, ...style };
  return <div
    aria-hidden="true"
    className={clsx("animate-skeleton bg-slate-200 bg-[linear-gradient(90deg,transparent_0%,rgb(255_255_255/0.7)_50%,transparent_100%)] bg-[length:200%_100%] bg-no-repeat portal:bg-sunken portal:bg-[linear-gradient(90deg,transparent_0%,color-mix(in_oklab,var(--c-fg)_9%,transparent)_50%,transparent_100%)] motion-reduce:animate-none", radius[rounded], "portal:rounded-xl", className)}
    style={size}
    {...props}
  />;
}

/**
 * Esqueleto de una página completa mientras cargan sus datos: título, descripción y filas.
 * Es la forma estándar de mostrar la carga en los portales (en lugar de un spinner).
 */
export function PageSkeleton({ rows = 4, rowHeight = 88, columns = 1 }: { rows?: number; rowHeight?: number; columns?: 1 | 2 | 3 }) {
  const grid = columns === 3 ? "md:grid-cols-2 xl:grid-cols-3" : columns === 2 ? "md:grid-cols-2" : "";
  return <div role="status" aria-busy="true" aria-label="Cargando">
    <Skeleton height={36} width="16rem" />
    <Skeleton className="mt-3" height={16} width="22rem" />
    <div className={clsx("mt-8 grid gap-4", grid)}>{Array.from({ length: rows }, (_, index) => <Skeleton key={index} height={rowHeight} rounded="2xl" />)}</div>
  </div>;
}
